"use server";

import { READ_ONLY } from "@/lib/config";

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * All write operations are disabled in read-only mode.
 */
export async function decide(input: {
  id: string;
  decision: "approve" | "edit" | "reject";
  text?: string;
  notes?: string;
}): Promise<ActionResult> {
  if (READ_ONLY) {
    return { ok: false, message: "Read-only mode: actions are disabled." };
  }

  return { ok: false, message: "Not implemented." };
}

export async function logView(id: string): Promise<void> {
  // No-op in read-only mode
}
