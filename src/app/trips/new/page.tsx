import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewTripForm } from "./NewTripForm";

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ tripName?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { tripName } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 bg-cream px-4 py-12">
      <h1 className="font-display text-3xl text-ink">Create a trip</h1>
      <NewTripForm defaultName={tripName} />
    </div>
  );
}
