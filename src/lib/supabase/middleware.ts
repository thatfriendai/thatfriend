import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the organizer's auth session cookie on every request, and hands
 * back the resolved auth user so proxy.ts's route guards don't need a
 * second, redundant auth.getUser() call.
 */
export async function updateSession(
  request: NextRequest
): Promise<{ response: NextResponse; user: User | null }> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session if expired — required for Server Components,
  // which can't write cookies themselves.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A signed-in visitor doesn't need the marketing homepage — this used to
  // be a second, redundant auth.getUser() call made again inside the page
  // itself (via getPlannerUser()) just to reach the same redirect, which
  // also meant that page could never be served as static/cached HTML.
  // Matches getPlannerUser()'s own gate (email-based sessions only — a
  // phone-only auth user isn't "logged in" for this purpose either).
  if (user?.email && request.nextUrl.pathname === "/") {
    const redirectResponse = NextResponse.redirect(new URL("/planner/home", request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return { response: redirectResponse, user };
  }

  return { response: supabaseResponse, user };
}
