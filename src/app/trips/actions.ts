"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createTrip(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const targetDates = String(formData.get("target_dates") ?? "").trim();

  if (!name) return { error: "Trip name is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      name,
      target_dates: targetDates || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !trip) {
    return { error: error?.message ?? "Could not create trip." };
  }

  const admin = createAdminClient();
  await admin.from("participants").insert({
    trip_id: trip.id,
    name: user.email ?? "Organizer",
    email: user.email,
    role: "organizer",
  });

  redirect(`/trip/${trip.id}`);
}
