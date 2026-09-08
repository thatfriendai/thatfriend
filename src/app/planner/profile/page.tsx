import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditNameForm } from "./EditNameForm";
import { PhoneLinkPanel } from "./PhoneLinkPanel";
import { ProfileFieldsForm } from "./ProfileFieldsForm";
import { TripVisibilityList } from "./TripVisibilityList";

export default async function ProfilePage() {
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("planner_memberships")
    .select("planner_trips(id, name, is_public)")
    .eq("user_id", user.id);
  const trips = (memberships ?? [])
    .map((m) => m.planner_trips as unknown as { id: string; name: string; is_public: boolean } | null)
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-5 border-b border-border bg-card px-5 py-5 sm:px-10">
        <Link href="/planner/trips" className="text-[23px] tracking-tight font-display text-ink">
          &ldquo;that friend&rdquo;
        </Link>
      </header>

      <div className="mx-auto max-w-[640px] px-6 py-15 pb-28">
        <h1 className="mb-10 text-[38px] leading-[1.08] font-display tracking-tight text-ink">
          Your profile
        </h1>

        <div className="flex flex-col gap-8">
          <div>
            <p className="mb-2 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
              Name
            </p>
            <EditNameForm initialName={user.name ?? ""} />
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
              Email
            </p>
            <span className="text-[15.5px] text-ink">{user.email ?? "No email on this account"}</span>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
              Phone
            </p>
            <PhoneLinkPanel currentPhone={user.phone} />
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Your phone is how texting works: forward a link or photo to
              That Friend&rsquo;s number and it lands on your trip&rsquo;s
              map, and nudges/reminders can go out over text.
            </p>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
              Public profile
            </p>
            <ProfileFieldsForm
              initialUsername={user.username ?? ""}
              initialTagline={user.tagline ?? ""}
              initialIsPublic={user.is_public}
            />
            {user.username && (
              <Link
                href={`/planner/u/${user.username}`}
                className="mt-2 inline-block text-[13px] text-accent hover:underline"
              >
                View your public profile →
              </Link>
            )}
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
              Your trips
            </p>
            <p className="mb-3 text-[13px] leading-relaxed text-muted">
              Public trips show up on your profile for friends to browse
              and copy from. Everything else about a trip stays the same
              either way.
            </p>
            <TripVisibilityList trips={trips} />
          </div>
        </div>
      </div>
    </div>
  );
}
