import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewTripForm } from "./NewTripForm";

export default async function NewTripPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Create a trip</h1>
      <NewTripForm />
    </div>
  );
}
