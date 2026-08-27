-- ============================================================================
--  Redaction review workflow — additive migration
--  Run in Supabase SQL Editor. Rename "tickets" / "ticket_text" if your table
--  uses different names, and keep src/lib/config.ts in sync.
--
--  This migration is additive: it adds columns, it does not drop or alter
--  existing ones. Review it before running against production.
-- ============================================================================

-- ── 1. Review workflow columns ──────────────────────────────────────────────
alter table public.tickets
  add column if not exists review_status  text not null default 'pending_review',
  add column if not exists reviewed_by    text,
  add column if not exists reviewed_at    timestamptz,
  add column if not exists reviewer_notes text,
  add column if not exists original_text  text;

alter table public.tickets
  drop constraint if exists tickets_review_status_check;

alter table public.tickets
  add constraint tickets_review_status_check
  check (review_status in ('pending_review', 'approved', 'edited', 'rejected'));

-- Preserve the pre-edit text so an edit is never destructive.
update public.tickets
   set original_text = ticket_text
 where original_text is null;

-- Keep original_text populated for rows inserted by the Intercom sync.
create or replace function public.tickets_set_original_text()
returns trigger
language plpgsql
as $$
begin
  if new.original_text is null then
    new.original_text := new.ticket_text;
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_set_original_text on public.tickets;
create trigger tickets_set_original_text
  before insert on public.tickets
  for each row execute function public.tickets_set_original_text();

-- Queue reads are "oldest pending first" — index for that access pattern.
create index if not exists tickets_review_queue_idx
  on public.tickets (review_status, created_at);

-- ── 2. Audit log ────────────────────────────────────────────────────────────
-- Who saw what, who changed what. Append-only; no update/delete policy exists.
create table if not exists public.ticket_review_audit (
  id           bigint generated always as identity primary key,
  ticket_id    text        not null,
  action       text        not null check (action in ('viewed', 'approved', 'edited', 'rejected')),
  actor_email  text        not null,
  text_changed boolean     not null default false,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists ticket_review_audit_ticket_idx
  on public.ticket_review_audit (ticket_id, created_at desc);

-- ── 3. Row Level Security ───────────────────────────────────────────────────
-- Ticket bodies may still contain personal data at this stage; that is the
-- whole point of the review step. Default-deny, then grant to reviewers only.
alter table public.tickets                enable row level security;
alter table public.ticket_review_audit    enable row level security;

-- Reviewer allowlist. Add reviewers here, not by widening the policies.
create table if not exists public.reviewers (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.reviewers enable row level security;

create or replace function public.is_active_reviewer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.reviewers
     where user_id = auth.uid() and active
  );
$$;

drop policy if exists "reviewers read tickets" on public.tickets;
create policy "reviewers read tickets"
  on public.tickets for select
  to authenticated
  using (public.is_active_reviewer());

-- Writes go through the server (service role), which bypasses RLS and always
-- writes an audit row. No client-side update policy is granted on purpose.

drop policy if exists "reviewers read own row" on public.reviewers;
create policy "reviewers read own row"
  on public.reviewers for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "reviewers read audit" on public.ticket_review_audit;
create policy "reviewers read audit"
  on public.ticket_review_audit for select
  to authenticated
  using (public.is_active_reviewer());

-- ── 4. Downstream pipeline view ─────────────────────────────────────────────
-- Point the AI pipeline at this view, never at public.tickets directly.
create or replace view public.tickets_cleared_for_ai as
  select *
    from public.tickets
   where review_status in ('approved', 'edited');

-- ── 5. Add your reviewers ───────────────────────────────────────────────────
-- After each reviewer has signed in once via magic link:
--
--   insert into public.reviewers (user_id, email)
--   select id, email from auth.users where email = 'reviewer@enpal.de'
--   on conflict (user_id) do update set active = true;
