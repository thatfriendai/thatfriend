import { describe, expect, it } from "vitest";
import { matchNamedTrip, matchSwitchCommand, type EligibleTrip } from "@/lib/planner/smsTripRouting";

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
