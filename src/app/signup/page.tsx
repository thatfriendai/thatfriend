import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ tripName?: string }>;
}) {
  const { tripName } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-cream px-4 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-3xl text-ink">
          Create an organizer account
        </h1>
        {tripName && (
          <p className="text-sm text-muted">
            Next: set up &ldquo;{tripName}&rdquo;
          </p>
        )}
      </div>
      <AuthForm action={signUp} submitLabel="Sign up" tripName={tripName} />
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium">
          Log in
        </Link>
      </p>
    </div>
  );
}
