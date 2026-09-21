import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { guideById } from "@/lib/planner/guides";

/**
 * Records that the caller opened a guide's detail page — best-effort,
 * fire-and-forget from the client. Feeds the friend-scoped "Jonah opened
 * this" line on every guide card; a repeat open is a harmless no-op
 * thanks to the (guide_id, user_id, kind) unique constraint.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: guideId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!guideById(guideId)) return NextResponse.json({ error: "Guide not found." }, { status: 404 });

  const admin = createAdminClient();
  await admin
    .from("planner_guide_interactions")
    .upsert({ guide_id: guideId, user_id: user.id, kind: "open" }, { onConflict: "guide_id,user_id,kind", ignoreDuplicates: true });

  return NextResponse.json({ ok: true });
}
