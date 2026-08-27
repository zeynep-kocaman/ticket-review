import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowedEmailDomains } from "@/lib/config";

export type Reviewer = { id: string; email: string };

/**
 * Returns the current reviewer, or null. Three gates must all pass:
 * a valid session, an allowed email domain, and an active row in
 * public.reviewers.
 */
export async function getReviewer(): Promise<Reviewer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;

  const email = data.user.email.toLowerCase();

  const domains = allowedEmailDomains();
  if (domains.length > 0 && !domains.some((d) => email.endsWith(`@${d}`))) {
    return null;
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("reviewers")
    .select("user_id, active")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!row?.active) return null;

  return { id: data.user.id, email };
}
