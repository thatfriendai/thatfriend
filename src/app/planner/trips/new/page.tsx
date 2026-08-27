import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { NewTripForm } from "./NewTripForm";

export default async function NewPlannerTripPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const user = await getPlannerUser();
  if (!user) redirect(`/planner/login`);

  const { name } = await searchParams;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card px-10 py-4.5">
        <span className="text-xl font-display text-ink">&ldquo;that friend&rdquo;</span>
        <span className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
          New trip
        </span>
        <div className="w-[100px]" />
      </header>
      <div className="mx-auto max-w-[660px] px-6 py-14 pb-28">
        <h1 className="mb-3 text-[44px] leading-[1.06] font-display tracking-tight text-ink">
          Start the trip you keep talking about.
        </h1>
        <p className="mb-11 text-base leading-relaxed text-body">
          Nothing here is final. You can leave any of it undecided and let
          the group sort it out.
        </p>
        <NewTripForm defaultName={name} />
      </div>
    </div>
  );
}
