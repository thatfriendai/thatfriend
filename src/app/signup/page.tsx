import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Create an organizer account</h1>
      <AuthForm action={signUp} submitLabel="Sign up" />
      <p className="text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
