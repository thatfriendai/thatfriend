import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { POPULAR_BACKFILL_COUNTRIES } from "@/lib/planner/popularCountries";
import { regionForCode } from "@/lib/planner/countries";

export async function POST(request: Request) {
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const option = POPULAR_BACKFILL_COUNTRIES.find((c) => c.code === body.country_code);
  if (!option) return NextResponse.json({ error: "Unknown country." }, { status: 400 });

  const cities = Array.isArray(body.cities)
    ? body.cities.filter((c: unknown): c is string => typeof c === "string" && c.trim().length > 0).map((c: string) => c.trim().slice(0, 60)).slice(0, 12)
    : [];
  const when = typeof body.when === "string" && body.when.trim() ? body.when.trim().slice(0, 40) : "Before That Friend";

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("planner_backfilled_countries")
    .upsert(
      { user_id: user.id, country_code: option.code, country_name: option.name, cities, travelled_when: when },
      { onConflict: "user_id,country_code" }
    )
    .select("country_code, country_name, cities, travelled_when")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    country: {
      code: row.country_code,
      name: row.country_name,
      cities: row.cities ?? [],
      when: row.travelled_when,
      region: regionForCode(row.country_code) ?? "Other",
    },
  });
}
