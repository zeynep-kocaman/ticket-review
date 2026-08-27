"use server";

import { revalidatePath } from "next/cache";

import { getReviewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { COL, STATUS, TABLE } from "@/lib/config";

export type ActionResult = { ok: true } | { ok: false; message: string };

type Decision = "approve" | "edit" | "reject";

const STATUS_FOR: Record<Decision, string> = {
  approve: STATUS.approved,
  edit: STATUS.edited,
  reject: STATUS.rejected,
};

const AUDIT_ACTION: Record<Decision, string> = {
  approve: "approved",
  edit: "edited",
  reject: "rejected",
};

/**
 * Records a reviewer's decision on one ticket.
 *
 * `text` is only written when the reviewer actually changed it. The pre-edit
 * body already lives in original_text (set on insert by a trigger), so an
 * edit is additive rather than destructive.
 */
export async function decide(input: {
  id: string;
  decision: Decision;
  text?: string;
  notes?: string;
}): Promise<ActionResult> {
  const reviewer = await getReviewer();
  if (!reviewer) {
    return { ok: false, message: "Your session ended. Sign in again to continue." };
  }

  const { id, decision } = input;
  if (!id) return { ok: false, message: "No ticket id was supplied." };

  const admin = createAdminClient();

  // Read current state so we can tell whether the text really changed and
  // avoid overwriting a decision another reviewer just made.
  const { data: current, error: readError } = await admin
    .from(TABLE)
    .select(`${COL.id}, ${COL.text}, ${COL.reviewStatus}`)
    .eq(COL.id, id)
    .maybeSingle();

  if (readError) return { ok: false, message: `Could not load the ticket: ${readError.message}` };
  if (!current) return { ok: false, message: "That ticket no longer exists." };

  if (current[COL.reviewStatus] !== STATUS.pending) {
    return { ok: false, message: "Another reviewer already handled this ticket. Loading the next one." };
  }

  const previousText: string = current[COL.text] ?? "";
  const nextText = input.text ?? previousText;
  const textChanged = decision === "edit" && nextText !== previousText;

  if (decision === "edit" && !textChanged) {
    return { ok: false, message: "Nothing changed. Use Approve if the ticket is already clean." };
  }

  const patch: Record<string, unknown> = {
    [COL.reviewStatus]: STATUS_FOR[decision],
    [COL.reviewedBy]: reviewer.email,
    [COL.reviewedAt]: new Date().toISOString(),
  };
  if (input.notes?.trim()) patch[COL.reviewerNotes] = input.notes.trim();
  if (textChanged) patch[COL.text] = nextText;

  const { error: writeError } = await admin
    .from(TABLE)
    .update(patch)
    .eq(COL.id, id)
    .eq(COL.reviewStatus, STATUS.pending); // optimistic lock

  if (writeError) return { ok: false, message: `Could not save: ${writeError.message}` };

  const { error: auditError } = await admin.from("ticket_review_audit").insert({
    ticket_id: String(id),
    action: AUDIT_ACTION[decision],
    actor_email: reviewer.email,
    text_changed: textChanged,
    notes: input.notes?.trim() || null,
  });

  // A failed audit write is a compliance problem, not a cosmetic one — surface it.
  if (auditError) {
    return {
      ok: false,
      message: `Saved, but the audit entry failed: ${auditError.message}. Report this before continuing.`,
    };
  }

  revalidatePath("/review");
  return { ok: true };
}

/** Logs that a reviewer opened a ticket containing unverified data. */
export async function logView(id: string): Promise<void> {
  const reviewer = await getReviewer();
  if (!reviewer || !id) return;

  await createAdminClient().from("ticket_review_audit").insert({
    ticket_id: String(id),
    action: "viewed",
    actor_email: reviewer.email,
  });
}
