import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, isUSPhone, normalizePhoneDigits, toE164 } from "@/lib/planner/phone";
import { extractPhoneNumbers, looksLikeInviteList } from "@/lib/planner/invitePhone";
import { PEOPLE } from "../../qa/fixtures";

describe("toE164 / isUSPhone", () => {
  it.each([
    ["+1 (415) 555-0101", "+14155550101"],
    ["415-555-0102", "+14155550102"],
    ["4155550103", "+14155550103"],
    ["1 415 555 0103", "+14155550103"],
    ["(415) 555.0103", "+14155550103"],
    [" +1 415 555 0106 ", "+14155550106"],
  ])("%s -> %s", (input, e164) => {
    expect(toE164(input)).toBe(e164);
    expect(isUSPhone(input)).toBe(true);
  });

  it.each([
    [PEOPLE.international.phone, "Turkish mobile"],
    [PEOPLE.ukFriend.phone, "UK national format"],
    ["+44 7700 900105", "UK international format"],
    ["555-0100", "too short"],
    ["", "empty"],
  ])("rejects %s (%s) as a US number", (input) => {
    expect(isUSPhone(input)).toBe(false);
  });

  it("digits-only form ignores formatting", () => {
    expect(normalizePhoneDigits("+1 (415) 555-0101")).toBe("14155550101");
  });

  it("formats US numbers for display and leaves others alone", () => {
    expect(formatPhoneDisplay("+14155550101")).toBe("+1 (415) 555-0101");
    expect(formatPhoneDisplay("+905325550104")).toBe("+905325550104");
  });
});

describe("extractPhoneNumbers", () => {
  it("pulls several differently-formatted numbers out of one text", () => {
    expect(extractPhoneNumbers("sara 415 555 0100, jen (415) 555-0101 and +1 415.555.0102")).toEqual([
      "+14155550100",
      "+14155550101",
      "+14155550102",
    ]);
  });

  it("dedupes the same number typed twice", () => {
    expect(extractPhoneNumbers("4155550100 or 415-555-0100")).toEqual(["+14155550100"]);
  });

  it("ignores numbers inside links (e.g. an Airbnb room id)", () => {
    expect(extractPhoneNumbers("https://www.airbnb.com/rooms/4155550100")).toEqual([]);
  });

  it("treats a short list of names + numbers as an invite list, a paragraph as not", () => {
    const list = "sara 415 555 0100, jen 415 555 0101";
    expect(looksLikeInviteList(list, extractPhoneNumbers(list))).toBe(true);
    const paragraph =
      "we should totally check out the taco place my cousin mentioned, her number is 415 555 0100 if you want to ask her about the best time to go and whether they take reservations for big groups";
    expect(looksLikeInviteList(paragraph, extractPhoneNumbers(paragraph))).toBe(false);
  });
});
