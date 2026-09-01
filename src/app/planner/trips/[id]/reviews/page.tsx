import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDays } from "@/lib/planner/days";
import { ReviewsBoard } from "./ReviewsBoard";
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

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();

  const { data: trip } = await admin
    .from("planner_trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) notFound();

  const days = await ensureDays(admin, trip);
  const dayIds = days.map((d) => d.id);

  const { data: items } = dayIds.length
    ? await admin
        .from("planner_itinerary_items")
        .select("*")
        .in("day_id", dayIds)
        .order("position", { ascending: true })
    : { data: [] as PlannerItineraryItem[] };

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

  const { data: myReview } = await admin
    .from("planner_trip_reviews")
    .select("*")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card px-7 py-4">
        <Link href={`/planner/trips/${tripId}`} className="text-[14px] text-body hover:text-accent">
          &larr; {trip.name}
        </Link>
      </header>
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
