import { redirect } from "next/navigation";

import { getReviewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CLEARED_STATUSES, COL, CONTEXT_COLUMNS, STATUS, TABLE } from "@/lib/config";
import ReviewDesk, { type TicketView } from "./ReviewDesk";

// Ticket bodies are unverified personal data — never prerender or cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReviewPage() {
  const reviewer = await getReviewer();
  if (!reviewer) redirect("/login");

  const supabase = await createClient();

  const selected = [
    COL.id,
    COL.text,
    COL.createdAt,
    ...(COL.externalId ? [COL.externalId] : []),
    ...CONTEXT_COLUMNS.map(([column]) => column),
  ].join(", ");

  const [{ data: rows, error }, { count: pending }, { count: clearedToday }] =
    await Promise.all([
      supabase
        .from(TABLE)
        .select(selected)
        .eq(COL.reviewStatus, STATUS.pending)
        .order(COL.createdAt, { ascending: true })
        .limit(1),
      supabase
        .from(TABLE)
        .select(COL.id, { count: "exact", head: true })
        .eq(COL.reviewStatus, STATUS.pending),
      supabase
        .from(TABLE)
        .select(COL.id, { count: "exact", head: true })
        .in(COL.reviewStatus, CLEARED_STATUSES)
        .gte(COL.reviewedAt, new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    ]);

  if (error) {
    return (
      <main>
        <div className="shell">
          <div className="centered">
            <span className="eyebrow">Could not load the queue</span>
            <h2>{error.message}</h2>
            <p>
              Check that the column names in <code>src/lib/config.ts</code> match your
              table and that <code>supabase/schema.sql</code> has been run.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const row = rows?.[0] as Record<string, unknown> | undefined;

  if (!row) {
    return (
      <main>
        <div className="shell">
          <div className="centered">
            <span className="eyebrow">Queue empty</span>
            <h2>Nothing waiting for review.</h2>
            <p>
              {clearedToday ?? 0} ticket{clearedToday === 1 ? "" : "s"} cleared today.
              New tickets appear here as the Intercom sync brings them in.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const ticket: TicketView = {
    id: String(row[COL.id]),
    text: (row[COL.text] as string) ?? "",
    externalId: COL.externalId ? ((row[COL.externalId] as string) ?? null) : null,
    createdAt: (row[COL.createdAt] as string) ?? null,
    context: CONTEXT_COLUMNS.filter(([column]) => row[column] != null).map(
      ([column, label]) => ({ label, value: String(row[column]) }),
    ),
  };

  return (
    <ReviewDesk
      ticket={ticket}
      pending={pending ?? 0}
      clearedToday={clearedToday ?? 0}
    />
  );
}
