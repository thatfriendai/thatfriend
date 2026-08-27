import { NextResponse } from "next/server";
import { getPlannerUser } from "@/lib/planner/session";

/**
 * Magic links verify themselves when clicked (see auth/callback) — there's
 * no code for the client to submit. This is the "am I signed in yet"
 * status check a client polls after sending the email, in case they opened
 * the link in a different tab/device.
 */
export async function POST() {
  const user = await getPlannerUser();
  return NextResponse.json({ user });
}
