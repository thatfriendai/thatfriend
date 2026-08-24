import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. Server-only (never import
 * from a Client Component). This is what powers guest access to trip data:
 * anyone holding a trip's shareable link can read/write that trip's data,
 * enforced by passing the trip id explicitly in every query below, not by
 * RLS. See supabase/schema.sql for the reasoning.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
