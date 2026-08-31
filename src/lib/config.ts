/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EDIT THIS FILE to match your existing Supabase table.
 * Nothing else in the app hardcodes a column name.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const TABLE = "ticket_data";

export const COL = {
  id: "id",
  text: "message",
  externalId: "conv_id",
} as const;

/**
 * Extra columns to display read-only above the ticket body, as
 * [column, label] pairs. Set to [] if you don't want any.
 */
export const CONTEXT_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["subject", "Subject"],
  ["source", "Source"],
];

export const STATUS = {
  pending: "pending_review",
  approved: "approved",
  edited: "edited",
  rejected: "rejected",
} as const;

export type ReviewStatus = (typeof STATUS)[keyof typeof STATUS];

/** Statuses your downstream AI pipeline is allowed to read. */
export const CLEARED_STATUSES: ReviewStatus[] = [STATUS.approved, STATUS.edited];

export const allowedEmailDomains = (): string[] =>
  (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

export const siteUrl = (): string =>
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
