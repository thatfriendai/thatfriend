/**
 * Seeds the QA cast (qa/fixtures.ts) into a STAGING Supabase project: one
 * auth user + planner_users row per persona, every scenario trip with its
 * members, and availability marks so the Dates view has something to chew
 * on. Writes the resulting ids to qa/.seed.json for the persona e2e specs.
 *
 *   QA_SEED_PROJECT=<staging project ref> npm run qa:seed
 *   QA_SEED_PROJECT=<staging project ref> npm run qa:seed -- --reset   # delete everything it created
 *
 * QA_SEED_PROJECT must match the project ref in NEXT_PUBLIC_SUPABASE_URL —
 * a guard against running this with production keys in .env.local.
 * Everything it creates is tagged ("[QA]" trip names, qa+<persona>@ emails)
 * so --reset can find it again without touching real rows.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync, existsSync } from "node:fs";
import { loadEnvLocal } from "./env";
import { PEOPLE, TRIPS, type PersonaKey } from "./fixtures";
import { dateRange } from "../src/lib/planner/calendarDate";
import { toE164 } from "../src/lib/planner/phone";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local or env).");
if (!projectRef || process.env.QA_SEED_PROJECT !== projectRef) {
  fail(`Refusing to seed: set QA_SEED_PROJECT=${projectRef ?? "<project ref>"} to confirm this is the staging project.`);
}

export const QA_PASSWORD = process.env.QA_PASSWORD ?? "qa-only-Password-123!";
const EMAIL_DOMAIN = process.env.QA_EMAIL_DOMAIN ?? "example.com";
const TRIP_PREFIX = "[QA] ";
const SEED_FILE = new URL("./.seed.json", import.meta.url);

const qaEmail = (key: string) => `qa+${key.toLowerCase()}@${EMAIL_DOMAIN}`;
const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });

if (process.argv.includes("--reset")) {
  await reset(admin);
} else {
  await reset(admin);
  await seed(admin);
}

async function seed(db: SupabaseClient) {
  const users: Record<string, { id: string; email: string }> = {};

  for (const [key, person] of Object.entries(PEOPLE)) {
    const email = qaEmail(key);
    const { data: created, error } = await db.auth.admin.createUser({
      email,
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: { name: person.name, qa: true },
    });
    if (error || !created.user) fail(`auth user ${key}: ${error?.message}`);

    const { data: row, error: rowError } = await db
      .from("planner_users")
      .insert({
        name: person.name,
        email,
        // Seeded phones are fictional 555-01xx numbers — texts to them fail
        // at Twilio instead of reaching a stranger.
        phone: person.phone ? toE164(person.phone) : null,
        auth_user_id: created.user.id,
        sms_opted_in_at: person.channel === "web" ? null : new Date().toISOString(),
      })
      .select("id")
      .single();
    if (rowError || !row) fail(`planner_users ${key}: ${rowError?.message}`);
    users[key] = { id: row.id, email };
  }

  const trips: Record<string, { id: string; members: PersonaKey[] }> = {};
  for (const [key, trip] of Object.entries(TRIPS)) {
    const owner = users[trip.members[0]].id;
    const locked = key === "weekend" || key === "newYears" || key === "pastTrip";
    const { data: row, error } = await db
      .from("planner_trips")
      .insert({
        name: TRIP_PREFIX + trip.name,
        destination: trip.destination,
        start_date: trip.start_date,
        end_date: trip.end_date,
        created_by: owner,
        dates_locked_at: locked ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error || !row) fail(`trip ${key}: ${error?.message}`);

    const members = trip.members as PersonaKey[];
    const { error: memberError } = await db.from("planner_memberships").insert(
      members.map((m, i) => ({ trip_id: row.id, user_id: users[m].id, role: i === 0 ? "owner" : "member" }))
    );
    if (memberError) fail(`memberships ${key}: ${memberError.message}`);

    // Everyone but the flaky one marks the trip's dates free (plus a day
    // either side for some, so the proposal has something to choose).
    if (trip.start_date && trip.end_date) {
      const marks = members
        .filter((m) => m !== "flaky")
        .flatMap((m, i) =>
          dateRange(trip.start_date!, trip.end_date!)
            .slice(0, i % 2 === 0 ? undefined : -1)
            .map((date) => ({ trip_id: row.id, user_id: users[m].id, date }))
        );
      if (marks.length) {
        const { error: markError } = await db.from("planner_availability_marks").insert(marks);
        if (markError) fail(`marks ${key}: ${markError.message}`);
      }
    }
    trips[key] = { id: row.id, members };
  }

  writeFileSync(SEED_FILE, JSON.stringify({ projectRef, password: QA_PASSWORD, users, trips }, null, 2));
  console.log(`Seeded ${Object.keys(users).length} people and ${Object.keys(trips).length} trips into ${projectRef}.`);
  console.log(`Sign in as any of them with qa+<persona>@${EMAIL_DOMAIN} / QA_PASSWORD. Ids written to qa/.seed.json.`);
}

async function reset(db: SupabaseClient) {
  const emails = Object.keys(PEOPLE).map(qaEmail);
  const { data: rows } = await db.from("planner_users").select("id, auth_user_id").in("email", emails);
  const ids = (rows ?? []).map((r) => r.id);
  if (ids.length) {
    await db.from("planner_trips").delete().in("created_by", ids).like("name", `${TRIP_PREFIX}%`);
    await db.from("planner_users").delete().in("id", ids);
  }
  // Auth users are listed page by page; QA ones are recognizable by email.
  for (let page = 1; ; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    const qa = (data?.users ?? []).filter((u) => u.email && emails.includes(u.email));
    for (const u of qa) await db.auth.admin.deleteUser(u.id);
    if (!data || data.users.length < 1000) break;
  }
  if (existsSync(SEED_FILE)) writeFileSync(SEED_FILE, "{}");
  console.log(`Removed ${ids.length} QA people and their [QA] trips from ${projectRef}.`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
