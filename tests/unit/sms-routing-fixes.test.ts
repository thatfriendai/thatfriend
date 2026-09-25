import { describe, expect, it } from "vitest";
import {
  isBareTripAnswer,
  isHoldFresh,
  isMissingTableError,
  matchNamedTrip,
  matchSwitchCommand,
  normalize,
  type EligibleTrip,
} from "@/lib/planner/smsTripRouting";
import { leaveWhichTripReply, whichTripReply } from "@/lib/planner/smsVoice";
import { PENDING_TRIP_ANSWER_MINUTES } from "@/config/limits";

const chicago: EligibleTrip = {
  id: "t1",
  name: "Chicago Homecoming",
  destination: "Chicago, IL, USA",
  join_code: "CHICAGO4K",
  twilio_conversation_sid: null,
};
const miami: EligibleTrip = {
  id: "t2",
  name: "Thanksgiving Miami",
  destination: "Miami, FL, USA",
  join_code: "MIAMIXYZ",
  twilio_conversation_sid: null,
};
const trips = [chicago, miami];

describe("matchNamedTrip", () => {
  it("matches the full trip name", () => {
    expect(matchNamedTrip("what's the plan for chicago homecoming?", trips)).toBe(chicago);
    expect(matchNamedTrip("any update on thanksgiving miami", trips)).toBe(miami);
  });

  it("matches the destination city alone", () => {
    expect(matchNamedTrip("found a great spot in chicago", trips)).toBe(chicago);
    expect(matchNamedTrip("miami has great tacos", trips)).toBe(miami);
  });

  it("matches a join code mentioned mid-message", () => {
    expect(matchNamedTrip("my code is CHICAGO4K right?", trips)).toBe(chicago);
  });

  it("is case- and punctuation-insensitive", () => {
    expect(matchNamedTrip("CHICAGO!!", trips)).toBe(chicago);
  });

  it("returns null when nothing names a trip", () => {
    expect(matchNamedTrip("what time should we meet", trips)).toBe(null);
    expect(matchNamedTrip("", trips)).toBe(null);
  });

  it("doesn't false-positive on a substring inside another word", () => {
    // "miami" must be its own word, not a fragment of "miamian" or similar.
    expect(matchNamedTrip("the miamian restaurant closed", trips)).toBe(null);
  });

  it("checks candidates in order, first match wins", () => {
    // Both trips could theoretically match a bare city; a message naming
    // one specifically should never fall through to the other.
    expect(matchNamedTrip("chicago", [miami, chicago])).toBe(chicago);
  });
});

describe("matchSwitchCommand", () => {
  it("matches 'switch to X'", () => {
    expect(matchSwitchCommand("switch to Miami", trips)).toBe(miami);
  });

  it("matches 'switch X' without 'to'", () => {
    expect(matchSwitchCommand("switch chicago", trips)).toBe(chicago);
  });

  it("is case-insensitive on the keyword", () => {
    expect(matchSwitchCommand("SWITCH TO chicago", trips)).toBe(chicago);
  });

  it("returns null for an ordinary message, even one that names a trip", () => {
    expect(matchSwitchCommand("chicago is great", trips)).toBe(null);
  });

  it("returns null when the named trip isn't a candidate", () => {
    expect(matchSwitchCommand("switch to Lisbon", trips)).toBe(null);
  });
});

// Trips from qa/fixtures.ts.
const lisbon: EligibleTrip = {
  id: "t3",
  name: "Lisbon in the fall",
  destination: "Lisbon, Portugal",
  join_code: "LISBON4K",
  twilio_conversation_sid: null,
};
const istanbul: EligibleTrip = {
  id: "t4",
  name: "İstanbul & São Paulo",
  destination: "İstanbul, Türkiye",
  join_code: null,
  twilio_conversation_sid: null,
};
const krakow: EligibleTrip = {
  id: "t5",
  name: "Just me in Kraków",
  destination: "Kraków, Poland",
  join_code: null,
  twilio_conversation_sid: null,
};

describe("normalize — accents fold instead of vanishing", () => {
  it("folds accents and the Turkish dotted İ", () => {
    expect(normalize("İstanbul & São Paulo")).toBe("istanbul sao paulo");
    expect(normalize("Kraków")).toBe("krakow");
  });
});

describe("matchNamedTrip — non-ASCII trips", () => {
  const all = [lisbon, istanbul, krakow];
  it("matches an unaccented spelling of an accented city", () => {
    expect(matchNamedTrip("anything good in istanbul?", all)).toBe(istanbul);
    expect(matchNamedTrip("krakow", all)).toBe(krakow);
  });
  it("matches the accented spelling too", () => {
    expect(matchNamedTrip("İstanbul", all)).toBe(istanbul);
    expect(matchNamedTrip("istanbul & sao paulo", [lisbon, istanbul])).toBe(istanbul);
  });
});

describe("isBareTripAnswer — when a held message is replayed", () => {
  it("is true for just the trip's name, city or code, with filler", () => {
    expect(isBareTripAnswer("lisbon", lisbon)).toBe(true);
    expect(isBareTripAnswer("Lisbon in the fall!", lisbon)).toBe(true);
    expect(isBareTripAnswer("oh it's the lisbon one", lisbon)).toBe(true);
    expect(isBareTripAnswer("LISBON4K", lisbon)).toBe(true);
    expect(isBareTripAnswer("istanbul", istanbul)).toBe(true);
    expect(isBareTripAnswer("fall", lisbon)).toBe(true); // a word of its name, e.g. resolved by the LLM
  });
  it("is false when the text says something more", () => {
    expect(isBareTripAnswer("lisbon — what time is checkin?", lisbon)).toBe(false);
    expect(isBareTripAnswer("time out market in lisbon", lisbon)).toBe(false);
    expect(isBareTripAnswer("", lisbon)).toBe(false);
  });
});

describe("isHoldFresh — held 'which trip?' messages expire", () => {
  const now = Date.parse("2026-09-25T12:00:00Z");
  it("keeps a recent hold", () => {
    expect(isHoldFresh(new Date(now - 5 * 60_000).toISOString(), now)).toBe(true);
  });
  it("drops one older than the window", () => {
    expect(isHoldFresh(new Date(now - (PENDING_TRIP_ANSWER_MINUTES + 1) * 60_000).toISOString(), now)).toBe(false);
    expect(isHoldFresh(new Date(now - 3 * 86_400_000).toISOString(), now)).toBe(false);
  });
  it("treats a missing/garbled timestamp as expired", () => {
    expect(isHoldFresh(null, now)).toBe(false);
    expect(isHoldFresh("not a date", now)).toBe(false);
  });
});

describe("isMissingTableError — pre-migration fallback", () => {
  it("recognizes Postgres and PostgREST missing-relation codes only", () => {
    expect(isMissingTableError({ code: "42P01" })).toBe(true);
    expect(isMissingTableError({ code: "PGRST205" })).toBe(true);
    expect(isMissingTableError({ code: "23505" })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
  });
});

describe("whichTripReply / leaveWhichTripReply wording", () => {
  it("offers a choice, not a list", () => {
    expect(whichTripReply(["Austin weekend", "Lisbon in the fall"])).toBe(
      "which trip is this for: Austin weekend or Lisbon in the fall?"
    );
    expect(whichTripReply(["A", "B", "C"])).toBe("which trip is this for: A, B or C?");
  });
  it("asks which trip to leave, and how to say it", () => {
    const text = leaveWhichTripReply(["Austin weekend", "Lisbon in the fall"]);
    expect(text).toContain("Austin weekend or Lisbon in the fall");
    expect(text).toContain("LEAVE");
  });
});
