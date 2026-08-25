import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-cream px-4 py-16">
      <h1 className="font-display text-3xl text-ink">Log in</h1>
      <AuthForm action={signIn} submitLabel="Log in" />
      <p className="text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="font-medium">
          Sign up
        </Link>
      </p>
    </div>
  );
}
