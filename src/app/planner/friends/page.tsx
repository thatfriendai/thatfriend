import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { listFriends } from "@/lib/planner/follows";

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
  const friends = await listFriends(admin, user.id);

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
              const label = f.name || f.username || "Someone";
              const inner = (
                <>
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] text-cream"
                    style={{ background: "#6E8C6A" }}
                  >
                    {initialsOf(label)}
                  </div>
                  <div>
                    <div className="text-[14.5px] text-ink-body">{label}</div>
                    {f.sharedTripCount > 0 && (
                      <div className="text-[12px] text-faint">
                        {f.sharedTripCount} trip{f.sharedTripCount === 1 ? "" : "s"} together
                      </div>
                    )}
                  </div>
                </>
              );
              return f.username ? (
                <Link
                  key={f.id}
                  href={`/planner/u/${f.username}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 hover:border-input-border"
                >
                  {inner}
                </Link>
              ) : (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
