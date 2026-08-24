import { createBrowserClient } from "@supabase/ssr";

/** Browser client for the organizer auth flow (e.g. Google OAuth redirect). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
