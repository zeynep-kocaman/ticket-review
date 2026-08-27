"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { countByKind, KIND_LABEL, segment } from "@/lib/pii";
import { decide, logView } from "./actions";

export type TicketView = {
  id: string;
  text: string;
  externalId: string | null;
  createdAt: string | null;
  context: Array<{ label: string; value: string }>;
};

type Props = {
  ticket: TicketView;
  pending: number;
  clearedToday: number;
};

export default function ReviewDesk({ ticket, pending, clearedToday }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ticket.text);
  const [notes, setNotes] = useState("");
  const [redacted, setRedacted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Reset local state when a new ticket arrives.
  useEffect(() => {
    setEditing(false);
    setDraft(ticket.text);
    setNotes("");
    setRedacted(false);
    setError(null);
  }, [ticket.id, ticket.text]);

  // Access to unverified ticket bodies is logged.
  useEffect(() => {
    void logView(ticket.id);
  }, [ticket.id]);

  useEffect(() => {
    if (editing) editorRef.current?.focus();
  }, [editing]);

  const segments = useMemo(() => segment(ticket.text), [ticket.text]);
  const findings = useMemo(() => countByKind(ticket.text), [ticket.text]);
  const draftFindings = useMemo(() => countByKind(draft), [draft]);

  const submit = useCallback(
    (decision: "approve" | "edit" | "reject") => {
      setError(null);
      startTransition(async () => {
        const result = await decide({
          id: ticket.id,
          decision,
          text: decision === "edit" ? draft : undefined,
          notes,
        });

        if (result.ok) {
          router.refresh();
        } else {
          setError(result.message);
          // Someone else took the ticket — move on rather than stalling.
          if (result.message.startsWith("Another reviewer")) {
            setTimeout(() => router.refresh(), 1200);
          }
        }
      });
    },
    [draft, notes, router, ticket.id],
  );

  // Keyboard shortcuts. Suppressed while typing so edits aren't hijacked.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "INPUT" ||
        target?.isContentEditable;

      if (event.metaKey && event.key === "Enter" && editing) {
        event.preventDefault();
        submit("edit");
        return;
      }

      if (event.key === "Escape" && editing) {
        event.preventDefault();
        setEditing(false);
        setDraft(ticket.text);
        return;
      }

      if (typing || isPending) return;

      switch (event.key.toLowerCase()) {
        case "a":
          event.preventDefault();
          submit("approve");
          break;
        case "e":
          event.preventDefault();
          setEditing(true);
          break;
        case "x":
          event.preventDefault();
          submit("reject");
          break;
        case "r":
          event.preventDefault();
          setRedacted((value) => !value);
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, isPending, submit, ticket.text]);

  const received = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleString("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  const shown = editing ? draftFindings : findings;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <h1 className="wordmark">
            redaction desk <span>/ support tickets</span>
          </h1>
          <div className="topbar-spacer" />
          <div className="counts">
            <div className="count">
              <span className="count-value">{pending}</span>
              <span className="eyebrow">waiting</span>
            </div>
            <div className="count">
              <span className="count-value">{clearedToday}</span>
              <span className="eyebrow">cleared today</span>
            </div>
          </div>
        </div>
        <div className="queue-rule">
          <div
            className="queue-rule-fill"
            style={{
              width: `${
                clearedToday + pending > 0
                  ? Math.round((clearedToday / (clearedToday + pending)) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
      </header>

      <main>
        <div className="shell">
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}

          <div className="meta-row">
            <div className="meta-item">
              <span className="eyebrow">Ticket</span>
              <span className="meta-value">{ticket.id}</span>
            </div>
            {ticket.externalId && (
              <div className="meta-item">
                <span className="eyebrow">Intercom</span>
                <span className="meta-value">{ticket.externalId}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="eyebrow">Received</span>
              <span className="meta-value">{received}</span>
            </div>
            {ticket.context.map(({ label, value }) => (
              <div className="meta-item" key={label}>
                <span className="eyebrow">{label}</span>
                <span className="meta-value">{value}</span>
              </div>
            ))}
          </div>

          <div className="findings">
            <span className="eyebrow">Pattern scan</span>
            {shown.length === 0 ? (
              <span className="chip chip-clean">no matches</span>
            ) : (
              shown.map(({ kind, count }) => (
                <span className="chip" key={kind}>
                  {KIND_LABEL[kind]} ×{count}
                </span>
              ))
            )}
          </div>

          {editing ? (
            <>
              <textarea
                ref={editorRef}
                className="editor"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                spellCheck={false}
                aria-label="Ticket text"
              />
              <textarea
                className="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What did you remove? (optional, stored with the audit entry)"
                aria-label="Reviewer notes"
              />
              <div className="actions">
                <button
                  className="btn btn-clear"
                  onClick={() => submit("edit")}
                  disabled={isPending || draft === ticket.text}
                >
                  Save changes and clear <kbd>⌘ ↵</kbd>
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setEditing(false);
                    setDraft(ticket.text);
                  }}
                  disabled={isPending}
                >
                  Discard edits <kbd>esc</kbd>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={`body-card${redacted ? " redacted" : ""}`}>
                <p className="ticket-text">
                  {segments.map((piece, index) =>
                    piece.kind ? (
                      <mark
                        className="flag"
                        data-kind={KIND_LABEL[piece.kind]}
                        key={index}
                      >
                        {piece.text}
                      </mark>
                    ) : (
                      <span key={index}>{piece.text}</span>
                    ),
                  )}
                </p>
              </div>

              <div className="actions">
                <button
                  className="btn btn-clear"
                  onClick={() => submit("approve")}
                  disabled={isPending}
                >
                  Clear for AI <kbd>A</kbd>
                </button>
                <button
                  className="btn"
                  onClick={() => setEditing(true)}
                  disabled={isPending}
                >
                  Edit text <kbd>E</kbd>
                </button>
                <button
                  className="btn btn-reject"
                  onClick={() => submit("reject")}
                  disabled={isPending}
                >
                  Hold back <kbd>X</kbd>
                </button>
                <button
                  className="btn"
                  onClick={() => setRedacted((value) => !value)}
                  disabled={isPending}
                >
                  {redacted ? "Show flagged text" : "Preview redacted"} <kbd>R</kbd>
                </button>
              </div>

              <p className="caution">
                Highlights come from pattern matching. They miss names, addresses written
                in prose, and anything unusual — read the whole ticket, not just the
                yellow. &ldquo;No matches&rdquo; means nothing matched, not that the ticket is clean.
              </p>
            </>
          )}
        </div>
      </main>

      <div className="rail">
        <div className="rail-inner">
          <span className="rail-item">
            <kbd>A</kbd> clear for AI
          </span>
          <span className="rail-item">
            <kbd>E</kbd> edit
          </span>
          <span className="rail-item">
            <kbd>X</kbd> hold back
          </span>
          <span className="rail-item">
            <kbd>R</kbd> redacted preview
          </span>
          <span className="rail-item">
            <kbd>⌘ ↵</kbd> save edits
          </span>
        </div>
      </div>
    </>
  );
}
