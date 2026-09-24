import { redirect } from "next/navigation";
import { getPlannerUser, safeNextPath } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNavCounts } from "@/lib/planner/navCounts";
import { HomeNav } from "@/components/planner/HomeNav";
import { signOut } from "../actions";
import { SettingsForm } from "./SettingsForm";

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

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; next?: string }>;
}) {
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login?next=/planner/profile");

  const { welcome, next } = await searchParams;
  const isWelcome = welcome === "1";
  const continueTo = isWelcome ? safeNextPath(next) : null;

  const admin = createAdminClient();
  const { tripsCount } = await getNavCounts(admin, user.id);
  const label = user.name || user.email || "?";

  return (
    <div className="min-h-screen">
      <HomeNav initial={initialsOf(label)} username={user.username} tripsCount={tripsCount} signOutAction={signOut} />
      <div className="mx-auto max-w-[1080px] px-6 py-10 sm:px-10">
        <div className="mb-2">
          <h1 className="text-[38px] leading-[1.08] font-display tracking-tight text-ink">
            {isWelcome ? "Set up your profile" : "Settings"}
          </h1>
        </div>
        <p className="mb-10 text-[15px] text-muted">
          {isWelcome
            ? "Pick a username and add your phone number so people can find your profile and That Friend can text you. Everything here is editable later — nothing's locked in."
            : "How you show up on trips, and how That Friend reaches you."}
        </p>

        <SettingsForm user={user} isWelcome={isWelcome} continueTo={continueTo} />
      </div>
    </div>
  );
}
