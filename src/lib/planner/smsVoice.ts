import "server-only";
import { TRENDING_CITIES } from "./guides";

/**
 * Every conversational reply That Friend texts back, in one place, so the
 * register stays consistent: it should read like a text from a person, not
 * a form wearing a text bubble. Rules, in order of how often they're
 * broken —
 *   - one question at a time; never stack dates + group size + budget
 *   - reflect back what they said before asking the next thing
 *   - describe outcomes ("once people start picking places"), never the
 *     internal object types ("add a lodging option as a decision")
 *   - no "Welcome to That Friend!", no numbered steps, no "please provide"
 *   - lowercase, contractions, short lines
 * The sign-in code (src/app/api/v2/auth/code/route.ts) is the one deliberate
 * exception — a utility text should look like every other OTP text.
 */

const ONE_QUESTION = `what's the trip — even just a city, or "no idea yet, help me pick" works.`;

/** A number we have no account for at all. */
export function unknownNumberReply(siteUrl: string) {
  return `hey! i don't have this number on file yet — sign in at ${siteUrl} with it, then text me anything.`;
}

/** Cold open from someone who isn't on any trip yet — the reply does the job of finding out what's going on. */
export function firstTimeGreetingReply() {
  return `hey! ${ONE_QUESTION}`;
}

/** A greeting from someone holding an invite they haven't accepted yet — the one thing worth pointing at. */
export function invitedGreetingReply(organizerFirstName: string, tripName: string) {
  return `hey! ${organizerFirstName} invited you to ${tripName} — reply 1 and you're in.`;
}

export function thanksReply() {
  return `anytime.`;
}

/** A greeting from someone already on a trip — straight to task, no orienting. */
export function returningGreetingReply(tripName: string) {
  return `hey! what've you got for ${tripName}? a link, a place, a question — anything works.`;
}

/** Anything that isn't a trip, from someone who has no trip to put it on. */
export function noTripYetReply() {
  return `i don't have a trip for you yet — ${ONE_QUESTION}`;
}

/** "no idea yet, help me pick" — the same question again, with somewhere to start. */
export function pickDestinationReply() {
  const names = TRENDING_CITIES.map((c) => c.name);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return `no problem. a few that people are planning right now: ${list}. any of those, or somewhere else?`;
}

/** The trip exists now — reflect it back, then exactly one next question. */
export function tripStartedReply(destination: string, when: string | null) {
  const echo = when ? `${destination} ${when}` : destination;
  return `got it — ${echo.toLowerCase()}. who's coming? text me their numbers and i'll send the invites.`;
}

/** Same, but texted from inside another trip's group thread — that thread keeps the phone, so the new trip can't be texted into yet. */
export function tripStartedFromGroupReply(destination: string, when: string | null, threadTripName: string, tripUrl: string) {
  const echo = when ? `${destination} ${when}` : destination;
  return `got it — ${echo.toLowerCase()}. this thread stays with ${threadTripName}, so the new one lives here for now: ${tripUrl}`;
}

/** After a message that was mostly phone numbers. */
export function invitesSentReply(sent: number, tripName: string, alreadyIn: number, invalid: number) {
  if (sent === 0) {
    if (alreadyIn > 0 && invalid === 0) return `${alreadyIn === 1 ? "they're" : "they're all"} already in ${tripName}.`;
    return `couldn't make out a number in that — send them like 415 555 0100 and i'll invite them.`;
  }
  const extra = [
    alreadyIn > 0 ? `${alreadyIn} already in` : null,
    invalid > 0 ? `${invalid} didn't look like a us number` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `sent — ${sent} text${sent === 1 ? "" : "s"} out for ${tripName}. they just reply 1 and they're in.${extra ? ` (${extra}.)` : ""}`;
}

/** Numbers arrived before there's any trip to invite them to. */
export function invitesNeedTripReply() {
  return `i'll invite them as soon as there's a trip — ${ONE_QUESTION}`;
}

export function joinedReply(tripName: string) {
  return `you're in — ${tripName}. forward me anything you find for it.`;
}

export function alreadyMemberReply(tripName: string) {
  return `you're already in ${tripName}.`;
}

export function joinCodeNotFoundReply() {
  return `hmm, that code doesn't match a trip — double-check it, or ask whoever sent it to resend.`;
}

export function lookupFailedReply() {
  return `something went wrong on my end — try that again in a bit.`;
}

export function optedOutReply() {
  return `ok — no more texts from me. reply START anytime to turn them back on.`;
}

export function optedBackInReply() {
  return `you're back in — text away.`;
}

export function nudgedReply(count: number, tripName: string) {
  if (count === 0) return `nobody to nudge right now.`;
  return `nudged ${count} ${count === 1 ? "person" : "people"} about ${tripName}.`;
}

export function closeDecisionSoonReply() {
  return `closing a poll by text is coming soon — head to the app to close this one.`;
}

export function unsupportedMediaReply() {
  return `i can only read text, links, and photos right now.`;
}

/** Saving a link/photo failed on our side — the raw error (a Postgres or Graph API message) is for the logs, not their phone. */
export function saveFailedReply() {
  return `couldn't save that one — something went wrong on my end. try sending it again in a bit.`;
}

// Twilio rejects a message body over 1600 characters outright (error
// 21617) — the reply just never arrives. placesAddedReply with a dozen
// far-away places and their addresses can get there, so every outgoing
// reply goes through this first. 1500 leaves room for the "…".
export const MAX_REPLY_CHARS = 1500;

/** Trims a reply to fit one SMS body, cutting at a sentence or word break rather than mid-word. */
export function capReply(text: string, max = MAX_REPLY_CHARS): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const sentenceEnd = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (sentenceEnd > max * 0.6) return head.slice(0, sentenceEnd + 1) + " …";
  const space = head.lastIndexOf(" ");
  return (space > max * 0.6 ? head.slice(0, space) : head).trimEnd() + "…";
}

export function placesAddedReply(
  tripName: string,
  duplicates: string[],
  farAway: { name: string; address: string | null }[]
) {
  const dupNote = duplicates.length > 0 ? ` (already had ${duplicates.join(", ")}.)` : "";
  const farNote =
    farAway.length > 0
      ? " " +
        farAway
          .map(
            (f) =>
              `heads up — ${f.name}${f.address ? ` (${f.address})` : ""} doesn't look like it's near ${tripName}, double check that's the right one.`
          )
          .join(" ")
      : "";
  return `added to ${tripName}!${dupNote}${farNote}`;
}

/** A video/article link got kept, but nothing in it named a place. */
export function linkSavedNoPlaceReply(tripName: string) {
  return `saved that to ${tripName}, but i couldn't tell which place it is — text me the name and i'll put it on the map.`;
}

export function alreadySavedReply() {
  return `already had that one — nothing new to add.`;
}

export function alreadyOnMapReply(tripName: string, duplicates: string[]) {
  return `already on the map for ${tripName}: ${duplicates.join(", ")}.`;
}

/** The group thread's opener — everyone in it already said yes to texts, so it can get straight to it. */
export function groupTextOpener(tripName: string, organizerFirstName: string | null) {
  const who = organizerFirstName ? `${organizerFirstName} looped me in` : `i'm in`;
  return `hey all — ${who} for ${tripName}. send links, places, or screenshots here and they land on the plan; ask me what's going on anytime.`;
}
