import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { SettingsForm } from "./SettingsForm";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const { welcome } = await searchParams;
  const isWelcome = welcome === "1";

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1080px] px-6 py-10 sm:px-10">
        <div className="mb-2 flex items-center gap-4">
          <Link
            href="/planner/home"
            aria-label="Back"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-input-border bg-card text-ink hover:border-ink"
          >
            ←
          </Link>
          <h1 className="text-[38px] leading-[1.08] font-display tracking-tight text-ink">
            {isWelcome ? "Set up your profile" : "Settings"}
          </h1>
        </div>
        <p className="mb-10 text-[15px] text-muted">
          {isWelcome
            ? "Pick a username so people can find your profile and trips. Everything here is editable later — nothing's locked in."
            : "How you show up on trips, and how That Friend reaches you."}
        </p>

        <SettingsForm user={user} />
      </div>
    </div>
  );
}
