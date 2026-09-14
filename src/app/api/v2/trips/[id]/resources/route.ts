import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { fetchPageText } from "@/lib/planner/fetchPage";

/**
 * Manual "+Add → A resource" — saves a link or a note as-is, with no place
 * extraction. This is the deliberate "keep this article/video around for
 * the group" action, distinct from the extraction flow (resources/extract)
 * which reads a link/text/screenshot looking for named places to add to
 * the map.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });

  const body = await request.json().catch(() => ({}));

  let type: "link" | "text";
  let label: string;
  let sourceUrl: string | null = null;

  if (body.type === "link") {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ error: "A link is required." }, { status: 400 });
    type = "link";
    sourceUrl = url;
    const page = await fetchPageText(url);
    label = page?.label ?? url;
  } else if (body.type === "text") {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "A note is required." }, { status: 400 });
    type = "text";
    label = text.slice(0, 200);
  } else {
    return NextResponse.json({ error: "Unknown resource type." }, { status: 400 });
  }

  const { data: resource, error } = await admin
    .from("planner_resources")
    .insert({ trip_id: tripId, type, label, source_url: sourceUrl, added_by: user.id })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ resource });
}
