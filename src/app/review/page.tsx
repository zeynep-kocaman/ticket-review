import { redirect } from "next/navigation";

import { getReviewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { COL, TABLE } from "@/lib/config";
import ReviewDesk, { type TicketView } from "./ReviewDesk";

// Ticket bodies are unverified personal data — never prerender or cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReviewPage() {
  const reviewer = await getReviewer();
  if (!reviewer) redirect("/login");

  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from(TABLE)
    .select(`${COL.id}, ${COL.text}`)
    .limit(1);

  if (error) {
    return (
      <main>
        <div className="shell">
          <div className="centered">
            <span className="eyebrow">Could not load tickets</span>
            <h2>{error.message}</h2>
            <p>
              Check that the column names in <code>src/lib/config.ts</code> match your
              table.
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
            <h2>No tickets to display.</h2>
            <p>New tickets will appear here as they are added to ticket_data.</p>
          </div>
        </div>
      </main>
    );
  }

  const ticket: TicketView = {
    id: String(row[COL.id]),
    text: (row[COL.text] as string) ?? "",
    externalId: null,
    createdAt: null,
    context: [],
  };

  return <ReviewDesk ticket={ticket} pending={0} clearedToday={0} />;
}
