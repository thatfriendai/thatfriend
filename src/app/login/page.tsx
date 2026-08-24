import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <AuthForm action={signIn} submitLabel="Log in" />
      <p className="text-sm text-zinc-500">
        No account?{" "}
        <Link href="/signup" className="font-medium underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
