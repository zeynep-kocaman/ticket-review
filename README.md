# Redaction desk

Manual review queue for support tickets before they reach an AI pipeline. A
reviewer reads each ticket, clears it, edits out anything the automated
redaction missed, or holds it back. Built for ~300 tickets/day.

Next.js (App Router) + Supabase. Deploys to Vercel with no other services.

---

## 1. Configure the table mapping

Open `src/lib/config.ts`. It is the only file that names database columns.
Set `TABLE` and the `COL` entries to match your existing table:

```ts
export const TABLE = "tickets";

export const COL = {
  id: "id",
  text: "ticket_text",              // the body a reviewer reads
  externalId: "intercom_conversation_id",
  createdAt: "created_at",
  // ...
};
```

`CONTEXT_COLUMNS` lists extra read-only fields shown above the ticket body
(subject, source, and so on). Set it to `[]` if you don't want any.

## 2. Run the migration

Paste `supabase/schema.sql` into the Supabase SQL editor. Read it first — it
touches a production table. It is additive (no drops, no column changes) and:

- adds `review_status`, `reviewed_by`, `reviewed_at`, `reviewer_notes`, `original_text`
- backfills `original_text` and adds a trigger so new rows keep it populated,
  which makes edits non-destructive
- indexes the queue read path (`review_status, created_at`)
- creates `ticket_review_audit` (append-only: who viewed, who changed what)
- creates a `reviewers` allowlist table
- **enables RLS on `tickets`** and grants read only to active reviewers
- creates the `tickets_cleared_for_ai` view

Enabling RLS is the change most likely to break something else. If your
Intercom sync writes with the anon key it will start failing — point it at the
service role key, or add an explicit insert policy for it.

## 3. Environment variables

Copy `.env.example` to `.env.local` for local work, and set the same four in
Vercel (Project → Settings → Environment Variables):

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | Your deployment URL, for magic-link redirects |
| `ALLOWED_EMAIL_DOMAINS` | e.g. `enpal.de`. Blank allows any existing user. |

## 4. Add reviewers

Reviewers sign in with a magic link. `shouldCreateUser: false` means signing in
does not create an account — an administrator adds people deliberately.

1. Supabase → Authentication → Users → invite the reviewer's address
2. After their first sign-in, add them to the allowlist:

```sql
insert into public.reviewers (user_id, email)
select id, email from auth.users where email = 'reviewer@enpal.de'
on conflict (user_id) do update set active = true;
```

Revoking access is `update public.reviewers set active = false where email = '…';`

## 5. Run and deploy

```bash
npm install
npm run dev            # http://localhost:3000
```

Deploy:

```bash
git remote add origin git@github.com:YOUR-ORG/enpal-ticket-review.git
git push -u origin main
```

Then import the repo in Vercel, add the environment variables, and deploy. Add
`https://your-app.vercel.app/auth/callback` to Supabase → Authentication → URL
Configuration → Redirect URLs.

---

## How the workflow behaves

| Reviewer action | `review_status` | Effect |
| --- | --- | --- |
| Clear for AI (`A`) | `approved` | Text untouched |
| Save edits (`⌘↵`) | `edited` | New text saved; `original_text` keeps the pre-edit body |
| Hold back (`X`) | `rejected` | Stays in the table for audit, excluded from the pipeline |

Every action writes a row to `ticket_review_audit`, including opening a ticket.
If the audit insert fails, the reviewer sees an error rather than a silent pass.

Two reviewers can work the queue at once: updates are guarded by
`.eq(review_status, 'pending_review')`, so the second one is told the ticket was
already handled and moves on.

**Point your AI pipeline at `public.tickets_cleared_for_ai`, not at
`public.tickets`.** That view is the boundary between reviewed and unreviewed
data, and it's the one thing that makes this whole workflow load-bearing.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `A` | Clear for AI |
| `E` | Edit text |
| `X` | Hold back |
| `R` | Toggle redacted preview (flagged spans as black bars) |
| `⌘↵` | Save edits |
| `esc` | Discard edits |

Shortcuts are disabled while typing in a text field.

## About the highlighting

`src/lib/pii.ts` pattern-matches e-mail addresses, German and international
phone numbers, IBANs, card-shaped digit runs, street/postcode patterns, licence
plates, dates of birth, URLs with query strings, and bare 7+ digit runs.

It is a reading aid with no authority in the workflow. It produces false
positives (order numbers that look like phone numbers) and **false negatives —
notably personal names, which it does not detect at all.** A clean scan means
nothing matched, not that the ticket contains no personal data. The UI says this
on every ticket on purpose; don't remove it, because a reviewer who trusts the
highlighting stops reading.

Add patterns to `RULES` in that file as you find gaps in real tickets.

---

## Before this goes live

This interface exists to catch redaction failures, which means by design it
shows reviewers personal data that has not yet been verified as clean. That
makes it a different thing from a normal internal dashboard.

The build includes RLS, an explicit reviewer allowlist, view-level audit
logging, no-store cache headers on `/review`, and `server-only` enforcement on
the service-role key. Those are technical controls, not a compliance sign-off.
Confirm with Data Protection, Legal & Compliance and IT Security whether this
processing needs documented approval — in particular the lawful basis for
reviewer access to unredacted ticket text, a retention limit on `original_text`
and on `ticket_review_audit`, and whether a DPIA is required. I can't confirm
any of that on your behalf, and nothing here should be read as having it.

One retention gap to decide on deliberately: `original_text` keeps the pre-edit
body indefinitely, which is what makes edits auditable but also means removed
personal data stays in the table. Add a scheduled job to null it out after your
chosen retention window.
