import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function FriendsPage() {
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const admin = createAdminClient();

  const { data: myTripRows } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("user_id", user.id);
  const myTripIds = new Set((myTripRows ?? []).map((m) => m.trip_id as string));

  const { data: followingRows } = await admin
    .from("planner_follows")
    .select("followee_id, planner_users!planner_follows_followee_id_fkey(id, name, username, email)")
    .eq("follower_id", user.id);

  const friends = (followingRows ?? [])
    .map((f) => f.planner_users as unknown as { id: string; name: string | null; username: string | null; email: string | null } | null)
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  const friendIds = friends.map((f) => f.id);
  const { data: theirMemberships } = friendIds.length
    ? await admin.from("planner_memberships").select("user_id, trip_id").in("user_id", friendIds)
    : { data: [] };

  const mutualCounts = new Map<string, number>();
  for (const m of theirMemberships ?? []) {
    if (myTripIds.has(m.trip_id)) {
      mutualCounts.set(m.user_id, (mutualCounts.get(m.user_id) ?? 0) + 1);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-5 border-b border-border bg-card px-5 py-5 sm:px-10">
        <Link href="/planner/trips" className="text-[23px] tracking-tight font-display text-ink">
          &ldquo;that friend&rdquo;
        </Link>
      </header>

      <div className="mx-auto max-w-[640px] px-6 py-15 pb-28">
        <h1 className="mb-2 text-[38px] leading-[1.08] font-display tracking-tight text-ink">
          Friends
        </h1>
        <p className="mb-10 text-[15px] text-body">
          Everyone you&rsquo;ve been on a trip with here, automatically.
        </p>

        {friends.length === 0 ? (
          <p className="text-[14px] text-muted">
            No one yet — joining or starting a trip with someone adds them here.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {friends.map((f) => {
              const mutual = mutualCounts.get(f.id) ?? 0;
              const label = f.name || f.email?.split("@")[0] || f.username || "Someone";
              return f.username ? (
                <Link
                  key={f.id}
                  href={`/planner/u/${f.username}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 hover:border-input-border"
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] text-cream"
                    style={{ background: "#6E8C6A" }}
                  >
                    {initialsOf(label)}
                  </div>
                  <div>
                    <div className="text-[14.5px] text-ink-body">{label}</div>
                    {mutual > 0 && (
                      <div className="text-[12px] text-faint">
                        {mutual} trip{mutual === 1 ? "" : "s"} together
                      </div>
                    )}
                  </div>
                </Link>
              ) : (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5"
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] text-cream"
                    style={{ background: "#6E8C6A" }}
                  >
                    {initialsOf(label)}
                  </div>
                  <div>
                    <div className="text-[14.5px] text-ink-body">{label}</div>
                    {mutual > 0 && (
                      <div className="text-[12px] text-faint">
                        {mutual} trip{mutual === 1 ? "" : "s"} together
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
