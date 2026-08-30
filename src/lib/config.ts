/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EDIT THIS FILE to match your existing Supabase table.
 * Nothing else in the app hardcodes a column name.
 * ─────────────────────────────────────────────────────────────────────────────
 */



export const TABLE = "ticket_data";

export const COL = {
  /** Conversation identifier. */
  id: "conv_id",

  /** Ticket message displayed in the interface. */
  text: "message",
} as const;

/**
 * No additional context columns are available in ticket_data.
 */
export const CONTEXT_COLUMNS: ReadonlyArray<readonly [string, string]> = [];

/**
 * The interface is read-only for now.
 *
 * The UI should use this to keep all action buttons disabled
 * and prevent editing, approving, rejecting, inserting, updating,
 * or deleting records.
 */
export const READ_ONLY = true;

export const allowedEmailDomains = (): string[] =>
  (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

export const siteUrl = (): string =>
  process.env.SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");


