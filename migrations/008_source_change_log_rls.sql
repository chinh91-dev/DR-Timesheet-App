-- ============================================================
-- MIGRATION 008: change_log RLS Policies
-- ⚠️  RUN THIS ON YOUR SOURCE DATABASE (time-team-tracker)
-- ============================================================
-- Enables Row Level Security on change_log and grants full
-- read/write access to all roles (anon, authenticated, service_role).
-- The trigger function needs INSERT, and the DR sync cron needs SELECT.
-- ============================================================

ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read change log entries
CREATE POLICY "Allow read for all"
  ON change_log
  FOR SELECT
  USING (true);

-- Allow anyone to insert (needed by the trigger function)
CREATE POLICY "Allow insert for all"
  ON change_log
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update (optional, future-proofing)
CREATE POLICY "Allow update for all"
  ON change_log
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow anyone to delete (for cleanup/retention)
CREATE POLICY "Allow delete for all"
  ON change_log
  FOR DELETE
  USING (true);
