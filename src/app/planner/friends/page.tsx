import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildFollowingLists } from "@/lib/planner/followingLists";
import { getNavCounts } from "@/lib/planner/navCounts";
import { signOut } from "@/app/planner/actions";
import { FollowingView } from "./FollowingView";

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export default async function FollowingPage() {
  const viewer = await getPlannerUser();
  if (!viewer) redirect("/planner/login");

  const admin = createAdminClient();

  const [{ startedFollowingYou, following, travelledWith, followerCount }, { tripsCount, savedCount }] = await Promise.all([
    buildFollowingLists(admin, viewer.id),
    getNavCounts(admin, viewer.id),
  ]);

  return (
    <FollowingView
      startedFollowingYou={startedFollowingYou}
      following={following}
      followerCount={followerCount}
      travelledWith={travelledWith}
      viewerUsername={viewer.username}
      navInitial={initialsOf(viewer.name || viewer.email || "?")}
      navTripsCount={tripsCount}
      navSavedCount={savedCount}
      signOutAction={signOut}
    />
  );
}
