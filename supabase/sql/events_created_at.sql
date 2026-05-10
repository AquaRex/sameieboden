-- ---------------------------------------------------------------------------
-- Sameieboden — ensure `events.created_at` exists.
-- Run once in the Supabase SQL editor. Idempotent (safe to re-run).
--
-- Adds a creation timestamp to every event row so the admin panel can
-- display "Opprettet" alongside the event itself. Existing rows get their
-- creation time backfilled to the current moment (we don't actually know
-- when they were originally created, so this is the best we can do).
-- ---------------------------------------------------------------------------

alter table events
  add column if not exists created_at timestamptz default now();

-- Backfill any pre-existing rows that came in before the column existed.
update events set created_at = now() where created_at is null;

create index if not exists events_created_at_idx on events (created_at desc);
