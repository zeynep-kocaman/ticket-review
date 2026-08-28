import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowedEmailDomains } from "@/lib/config";

export type Reviewer = { id: string; email: string };

/**
 * Returns the current reviewer, or null if no valid session exists.
 * For password auth, we skip the allowlist check since accounts
 * are created explicitly in Supabase Auth.
 */
export async function getReviewer(): Promise<Reviewer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;

  return { id: data.user.id, email: data.user.email };
}
