import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveInviteToken } from "@/lib/planner/joinLink";
import { loadJoinPreview } from "@/lib/planner/joinPreview";
import { loadBrandFonts, OG_COLORS, Wordmark } from "@/lib/og/brand";

/**
 * The picture in an invite link's WhatsApp/iMessage preview: who's asking,
 * where, and when. Linked as og:image from both invite pages' metadata
 * (/j/… and /join/…). Everything sits on the centre line because WhatsApp
 * often crops the card to a square thumbnail.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const invite = await resolveInviteToken(admin, token);
  const preview = invite ? await loadJoinPreview(admin, invite.tripId) : null;

  const tripName = preview?.tripName ?? "";
  // Long names step down so they stay on one or two lines.
  const nameSize = tripName.length > 28 ? 88 : tripName.length > 16 ? 112 : 150;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: OG_COLORS.plum,
          padding: "0 90px",
          textAlign: "center",
        }}
      >
        {preview ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 50, color: OG_COLORS.blush }}>
              {preview.ownerName} invites you to
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Instrument Serif",
                fontSize: nameSize,
                lineHeight: 1.05,
                color: OG_COLORS.cream,
                marginTop: 14,
                justifyContent: "center",
              }}
            >
              {tripName}
            </div>
            {preview.dateRange && (
              <div style={{ display: "flex", fontSize: 34, color: OG_COLORS.muted, marginTop: 26, letterSpacing: 1 }}>
                {preview.dateRange}
              </div>
            )}
          </div>
        ) : (
          <Wordmark size={132} color={OG_COLORS.cream} />
        )}
        {preview && (
          <div style={{ display: "flex", position: "absolute", bottom: 44 }}>
            <Wordmark size={40} />
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: await loadBrandFonts(),
      // Previews get re-fetched rarely; a trip rename showing up within the hour is plenty.
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    },
  );
}
