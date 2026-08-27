import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { NewTripForm } from "./NewTripForm";

export default async function NewPlannerTripPage() {
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 bg-cream px-4 py-12">
      <div className="rounded-2xl border border-dashed border-border p-3 text-center text-xs text-muted">
        Placeholder page — not yet styled to the &quot;New trip&quot; screen design.
      </div>
      <h1 className="font-display text-3xl text-ink">Create a trip</h1>
      <NewTripForm />
    </div>
  );
}
