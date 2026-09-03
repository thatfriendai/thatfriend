import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { EditNameForm } from "./EditNameForm";
import { PhoneLinkPanel } from "./PhoneLinkPanel";

export default async function ProfilePage() {
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

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
        </div>
      </div>
    </div>
  );
}
