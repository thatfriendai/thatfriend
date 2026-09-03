"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

export async function updateName(name: string): Promise<{ error?: string }> {
  const user = await getPlannerUser();
  if (!user) return { error: "Not signed in." };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Name can't be empty." };

  const { error } = await createAdminClient()
    .from("planner_users")
    .update({ name: trimmed })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/planner/profile");
  return {};
}
