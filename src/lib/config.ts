/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EDIT THIS FILE to match your existing Supabase table.
 * Nothing else in the app hardcodes a column name.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const TABLE = "tickets";

export const COL = {
  /** Primary key. */
  id: "id",

  /** The redacted ticket body a reviewer reads and may edit. */
  text: "ticket_text",

  /** Snapshot of `text` taken before the first manual edit. Added by schema.sql. */
  originalText: "original_text",

  /** Intercom conversation id, shown for traceability. Set to null if absent. */
  externalId: "intercom_conversation_id",

  /** Used to order the queue oldest-first. */
  createdAt: "created_at",

  // ── Columns added by supabase/schema.sql ──
  reviewStatus: "review_status",
  reviewedBy: "reviewed_by",
  reviewedAt: "reviewed_at",
  reviewerNotes: "reviewer_notes",
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
  process.env.SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
