import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { fetchPageText } from "@/lib/planner/fetchPage";
import { extractPlacesFromText, extractPlacesFromImage } from "@/lib/planner/extract";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

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
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const type = body.type;

  let label: string;
  let sourceUrl: string | null = null;
  let candidates;

  if (type === "link") {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ error: "A link is required." }, { status: 400 });
    const page = await fetchPageText(url);
    if (!page) {
      return NextResponse.json(
        { error: "Couldn't read that link. Try pasting the text instead." },
        { status: 422 }
      );
    }
    sourceUrl = url;
    label = page.label;
    candidates = await extractPlacesFromText(page.text);
  } else if (type === "text") {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "Paste some text first." }, { status: 400 });
    label = text.slice(0, 60) + (text.length > 60 ? "…" : "");
    candidates = await extractPlacesFromText(text);
  } else if (type === "screenshot") {
    const image = typeof body.image === "string" ? body.image : "";
    const mediaType = IMAGE_TYPES.includes(body.mediaType) ? body.mediaType : null;
    if (!image || !mediaType) {
      return NextResponse.json({ error: "A screenshot is required." }, { status: 400 });
    }
    label = "Screenshot";
    candidates = await extractPlacesFromImage(image, mediaType);
  } else {
    return NextResponse.json({ error: "Unknown source type." }, { status: 400 });
  }

  const { data: resource, error } = await admin
    .from("planner_resources")
    .insert({
      trip_id: tripId,
      type,
      label,
      source_url: sourceUrl,
      added_by: user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ resource, candidates });
}
