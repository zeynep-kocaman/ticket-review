import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS, so it is only ever used inside server
 * actions that have already verified the caller is an active reviewer, and
 * every write it performs is paired with an audit row.
 *
 * "server-only" makes the build fail if this is ever imported by a Client
 * Component, which is what keeps the key out of the browser bundle.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
