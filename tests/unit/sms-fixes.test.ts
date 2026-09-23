import { describe, expect, it, vi } from "vitest";

// whatsappResource → extract instantiates an Anthropic client at import.
vi.mock("@anthropic-ai/sdk", () => ({ default: class {} }));

import { extractPhoneNumbers, looksLikeInviteList } from "@/lib/planner/invitePhone";
import { detectOptKeyword, handleOptKeywordFromBody, recordConsentEvent } from "@/lib/planner/consent";
import { isPrivateAddress } from "@/lib/planner/fetchPage";
import { capReply, placesAddedReply, MAX_REPLY_CHARS } from "@/lib/planner/smsVoice";
import { normalizeSourceUrl, splitLinkAndCaption } from "@/lib/planner/whatsappResource";

describe("extractPhoneNumbers — international numbers aren't US numbers", () => {
  it.each([
    ["+442079460958", "UK, no spaces"],
    ["+4915112345678", "German mobile, no spaces"],
    ["+44 207 946 0958", "UK, spaced so the tail looks like a US number"],
    ["+90 532 555 0104", "Turkish mobile"],
  ])("%s (%s) -> nothing", (text) => {
    expect(extractPhoneNumbers(text)).toEqual([]);
  });

  it("still finds the US number next to an international one", () => {
    expect(extractPhoneNumbers("deniz +90 532 555 0104, sara 415 555 0100")).toEqual(["+14155550100"]);
  });

  it("doesn't pull ten digits out of a longer run", () => {
    expect(extractPhoneNumbers("order 941555501001")).toEqual([]);
  });

  it("still accepts +1 and bare US forms", () => {
    expect(extractPhoneNumbers("+14155550100 and (415) 555-0101")).toEqual(["+14155550100", "+14155550101"]);
  });
});

describe("looksLikeInviteList — a business listing isn't a list of friends", () => {
  it("rejects a restaurant with a street address", () => {
    const listing = "Nopa 560 Divisadero St (415) 864-8643";
    expect(extractPhoneNumbers(listing)).toEqual(["+14158648643"]);
    expect(looksLikeInviteList(listing, extractPhoneNumbers(listing))).toBe(false);
  });

  it("still accepts names + numbers", () => {
    const list = "sara 415 555 0100, jen (415) 555-0101";
    expect(looksLikeInviteList(list, extractPhoneNumbers(list))).toBe(true);
  });
});

describe("detectOptKeyword", () => {
  it("doesn't treat 'yes' as an opt-in", () => {
    expect(detectOptKeyword("yes")).toBe(null);
    expect(detectOptKeyword("YES")).toBe(null);
  });

  it("keeps Twilio's standard keywords in a 1:1 thread", () => {
    for (const word of ["stop", "STOPALL", "unsubscribe", "cancel", "end", "quit"]) {
      expect(detectOptKeyword(word)).toBe("stop");
    }
    expect(detectOptKeyword("start")).toBe("start");
    expect(detectOptKeyword(" Unstop ")).toBe("start");
  });

  it("in a group thread only honors the unambiguous stop words", () => {
    for (const word of ["cancel", "end", "quit"]) {
      expect(detectOptKeyword(word, { groupThread: true })).toBe(null);
    }
    for (const word of ["stop", "stopall", "unsubscribe"]) {
      expect(detectOptKeyword(word, { groupThread: true })).toBe("stop");
    }
  });

  it("only matches the whole message", () => {
    expect(detectOptKeyword("stop sending the old plan")).toBe(null);
  });
});

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "100.127.255.255",
    "0.0.0.0",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "[::1]",
    "not-an-ip",
  ])("%s is private", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "172.32.0.1", "100.128.0.1", "142.250.72.14", "2607:f8b0:4005:80a::200e", "::ffff:8.8.8.8"])(
    "%s is public",
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  );
});

describe("capReply", () => {
  it("leaves short replies alone", () => {
    expect(capReply("added to lisbon!")).toBe("added to lisbon!");
  });

  it("keeps a long placesAddedReply under Twilio's 1600-char limit", () => {
    const farAway = Array.from({ length: 12 }, (_, i) => ({
      name: `Some Restaurant With A Long Name ${i}`,
      address: `${100 + i} Extremely Long Boulevard Name, Neighborhood, Some City, ST 00000, United States`,
    }));
    const full = placesAddedReply("Lisbon", ["A", "B"], farAway);
    expect(full.length).toBeGreaterThan(1600);
    const capped = capReply(full);
    expect(capped.length).toBeLessThanOrEqual(MAX_REPLY_CHARS);
    expect(capped.startsWith("added to Lisbon!")).toBe(true);
    expect(capped.endsWith("…")).toBe(true);
  });

  it("cuts at a word break when there's no sentence break", () => {
    const capped = capReply("word ".repeat(400), 100);
    expect(capped.length).toBeLessThanOrEqual(100);
    expect(capped).toMatch(/word…$/);
  });
});

describe("splitLinkAndCaption", () => {
  it("separates a link from a caption typed under it", () => {
    expect(splitLinkAndCaption("https://vm.tiktok.com/ZMabc/\nmust go")).toEqual({
      url: "https://vm.tiktok.com/ZMabc/",
      caption: "must go",
    });
  });

  it("finds a link after a caption", () => {
    expect(splitLinkAndCaption("Check this out https://maps.app.goo.gl/abc")).toEqual({
      url: "https://maps.app.goo.gl/abc",
      caption: "Check this out",
    });
  });

  it("drops trailing sentence punctuation", () => {
    expect(splitLinkAndCaption("(see https://example.com/post).")?.url).toBe("https://example.com/post");
    expect(splitLinkAndCaption("https://en.wikipedia.org/wiki/Foo_(bar)")?.url).toBe(
      "https://en.wikipedia.org/wiki/Foo_(bar)"
    );
  });

  it("returns null for plain text", () => {
    expect(splitLinkAndCaption("dinner at nopa?")).toBe(null);
  });
});

describe("normalizeSourceUrl", () => {
  it("strips share-tracking params and keeps real ones", () => {
    expect(normalizeSourceUrl("https://www.instagram.com/p/abc/?igsh=xyz&utm_source=ig")).toBe(
      "https://www.instagram.com/p/abc/"
    );
    expect(normalizeSourceUrl("https://youtu.be/abc?si=123&t=42")).toBe("https://youtu.be/abc?t=42");
  });
});

describe("consent — only an explicit START re-opts someone in after STOP", () => {
  function fakeAdmin() {
    const writes: { table: string; op: string; value: unknown }[] = [];
    const admin = {
      from: (table: string) => ({
        update: (value: unknown) => ({
          eq: async () => {
            writes.push({ table, op: "update", value });
            return { error: null };
          },
        }),
        insert: async (value: unknown) => {
          writes.push({ table, op: "insert", value });
          return { error: null };
        },
      }),
    };
    return { admin: admin as never, writes };
  }
  const stopped = { id: "u1", phone: "+14155550100", notify_sms: false, sms_opted_in_at: "2026-01-01T00:00:00Z" };
  const neverAsked = { ...stopped, sms_opted_in_at: null };

  it("an ordinary text after STOP changes nothing", async () => {
    const { admin, writes } = fakeAdmin();
    await recordConsentEvent(admin, stopped, "inbound_reply");
    await recordConsentEvent(admin, stopped, "join_code", "t1");
    expect(writes).toEqual([]);
  });

  it("START after STOP re-opts in", async () => {
    const { admin, writes } = fakeAdmin();
    expect(await handleOptKeywordFromBody(admin, stopped, "START")).toBe("start");
    expect(writes[0]).toMatchObject({ table: "planner_users", value: { notify_sms: true } });
    expect(writes[1]).toMatchObject({ table: "planner_sms_consent_log", value: { method: "re_opt_in_after_stop" } });
  });

  it("a first-ever text still opts in", async () => {
    const { admin, writes } = fakeAdmin();
    await recordConsentEvent(admin, neverAsked, "inbound_reply");
    expect(writes[1]).toMatchObject({ table: "planner_sms_consent_log", value: { method: "inbound_reply" } });
  });

  it("START from someone already opted in isn't consumed", async () => {
    const { admin, writes } = fakeAdmin();
    expect(await handleOptKeywordFromBody(admin, { ...stopped, notify_sms: true }, "start")).toBe(null);
    expect(writes).toEqual([]);
  });
});

describe("looksLikeJoinCode", () => {
  it.each(["LISBON4K", "lisbon4k", "MIAMIXYZ", "TRIP7QR"])("%s is a code attempt", async (word) => {
    const { looksLikeJoinCode } = await import("@/lib/planner/smsTripStart");
    expect(looksLikeJoinCode(word)).toBe(true);
  });

  it.each(["tomorrow", "them", "Sarah", "everyone"])("%s is conversation", async (word) => {
    const { looksLikeJoinCode } = await import("@/lib/planner/smsTripStart");
    expect(looksLikeJoinCode(word)).toBe(false);
  });
});
