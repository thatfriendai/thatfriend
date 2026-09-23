import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDays } from "@/lib/planner/days";
import { ReviewsBoard } from "./ReviewsBoard";
import { PlaceRatingQueue } from "./PlaceRatingQueue";
import { listVisits } from "@/lib/planner/ratingCapture";
import { listLessons } from "@/lib/planner/lessons";
import { LessonsCard } from "./LessonsCard";
import type { PlannerItineraryItem } from "@/lib/supabase/planner-types";

function labelOf(person: { name: string | null; email: string | null } | null) {
  return person?.name || person?.email?.split("@")[0] || "Someone";
}

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const admin = createAdminClient();

  // Phase 1: only depends on tripId/user.id — one round trip instead of
  // four sequential ones.
  const [{ data: membership }, { data: trip }, { data: myReview }, visits, lessons] = await Promise.all([
    admin.from("planner_memberships").select("trip_id").eq("trip_id", tripId).eq("user_id", user.id).maybeSingle(),
    admin.from("planner_trips").select("*").eq("id", tripId).maybeSingle(),
    admin.from("planner_trip_reviews").select("*").eq("trip_id", tripId).eq("user_id", user.id).maybeSingle(),
    listVisits(admin, tripId),
    listLessons(admin, tripId),
  ]);
  if (!membership) notFound();
  if (!trip) notFound();

  const days = await ensureDays(admin, trip);
  const dayIds = days.map((d) => d.id);
  const visitIds = visits.map((v) => v.id);

  // Phase 2: items (needs dayIds) and placeRatingRows (needs visitIds from
  // phase 1) don't depend on each other.
  const [{ data: items }, { data: placeRatingRows }] = await Promise.all([
    dayIds.length
      ? admin.from("planner_itinerary_items").select("*").in("day_id", dayIds).order("position", { ascending: true })
      : Promise.resolve({ data: [] as PlannerItineraryItem[] }),
    visitIds.length
      ? admin.from("planner_place_ratings").select("place_id, user_id, rating, body, planner_users(name, email)").in("place_id", visitIds)
      : Promise.resolve({ data: [] }),
  ]);

  const itemIds = (items ?? []).map((i) => i.id);
  const { data: ratingRows } = itemIds.length
    ? await admin
        .from("planner_item_ratings")
        .select("*, planner_users(name, email)")
        .in("item_id", itemIds)
    : { data: [] };

  const ratings = (ratingRows ?? []).map((r) => ({
    ...r,
    who: labelOf(r.planner_users as unknown as { name: string | null; email: string | null } | null),
  }));

  const daysWithItems = days.map((d) => ({
    ...d,
    items: (items ?? []).filter((i) => i.day_id === d.id),
  }));

  const myPlaceRatings: Record<string, { rating: number; body: string | null }> = {};
  const othersByPlace: Record<string, { who: string; rating: number }[]> = {};
  for (const r of placeRatingRows ?? []) {
    if (r.user_id === user.id) {
      myPlaceRatings[r.place_id] = { rating: r.rating, body: r.body };
    } else {
      const person = r.planner_users as unknown as { name: string | null; email: string | null } | null;
      const who = person?.name || person?.email?.split("@")[0] || "Someone";
      (othersByPlace[r.place_id] ??= []).push({ who, rating: r.rating });
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card px-7 py-5">
        <Link href={`/planner/trips/${tripId}`} className="flex items-center gap-2 text-[17px] font-medium text-ink hover:text-accent">
          <span aria-hidden>&larr;</span> {trip.name}
        </Link>
      </header>
      {visits.length > 0 && (
        <div className="mx-auto max-w-[820px] px-6 pt-9.5">
          <PlaceRatingQueue
            tripId={tripId}
            visits={visits}
            initialMyRatings={myPlaceRatings}
            othersByPlace={othersByPlace}
            showSocialProof={trip.privacy !== "private"}
          />
        </div>
      )}
      <div className="mx-auto max-w-[820px] px-6 pt-9.5">
        <LessonsCard tripId={tripId} myUserId={user.id} initial={lessons} />
      </div>
      <ReviewsBoard
        tripId={tripId}
        tripName={trip.name}
        destination={trip.destination}
        endDate={trip.end_date}
        myUserId={user.id}
        days={daysWithItems}
        ratings={ratings}
        myReview={myReview}
        shareToken={trip.share_token}
      />
    </div>
  );
}
