import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { regionForCode } from "./countries";

export interface BackfilledCountry {
  code: string;
  name: string;
  cities: string[];
  when: string | null;
  region: string;
}

/** Countries a user added by hand to their profile map — travel from before they joined, with no trip or ratings behind it. */
export async function listBackfilledCountries(admin: SupabaseClient, userId: string): Promise<BackfilledCountry[]> {
  const { data } = await admin
    .from("planner_backfilled_countries")
    .select("country_code, country_name, cities, travelled_when")
    .eq("user_id", userId);

  return (data ?? []).map((r) => ({
    code: r.country_code as string,
    name: r.country_name as string,
    cities: (r.cities as string[] | null) ?? [],
    when: r.travelled_when as string | null,
    region: regionForCode(r.country_code as string) ?? "Other",
  }));
}
