-- ============================================================
-- MIGRATION 007: PITR Infrastructure — DR Database
-- ✅ RUN THIS ON YOUR DR DATABASE (dr-timesheet-app project)
-- ============================================================

-- Mirrored change log — synced from source DB every 5 minutes.
-- source_id preserves the original change_log.id from the source
-- so the checkpoint can track exactly where we are.
CREATE TABLE IF NOT EXISTS dr_change_log (
  id              BIGSERIAL PRIMARY KEY,
  source_id       BIGINT NOT NULL,        -- original change_log.id from source DB
  changed_at      TIMESTAMPTZ NOT NULL,
  table_name      TEXT NOT NULL,
  operation       TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  row_id          TEXT,
  new_data        JSONB,
  old_data        JSONB,
  transaction_id  BIGINT,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dr_change_log_source_id  ON dr_change_log (source_id);
CREATE INDEX        IF NOT EXISTS idx_dr_change_log_changed_at  ON dr_change_log (changed_at);
CREATE INDEX        IF NOT EXISTS idx_dr_change_log_table_time  ON dr_change_log (table_name, changed_at);

-- Checkpoint table — one row per tracked source DB.
-- Stores the highest source_id we have successfully synced.
CREATE TABLE IF NOT EXISTS dr_pitr_checkpoints (
  id                  SERIAL PRIMARY KEY,
  source_label        TEXT NOT NULL UNIQUE DEFAULT 'time-team-tracker',
  last_synced_id      BIGINT NOT NULL DEFAULT 0,   -- highest source change_log.id synced
  last_synced_at      TIMESTAMPTZ,                  -- timestamp of that change
  last_sync_run_at    TIMESTAMPTZ,                  -- when the cron last ran
  total_entries_synced BIGINT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the initial checkpoint row
INSERT INTO dr_pitr_checkpoints (source_label, last_synced_id)
VALUES ('time-team-tracker', 0)
ON CONFLICT (source_label) DO NOTHING;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_pitr_checkpoint_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_pitr_checkpoint_updated_at
  BEFORE UPDATE ON dr_pitr_checkpoints
  FOR EACH ROW EXECUTE FUNCTION update_pitr_checkpoint_timestamp();

-- RLS
ALTER TABLE dr_change_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dr_pitr_checkpoints    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read change log"
  ON dr_change_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read checkpoints"
  ON dr_pitr_checkpoints FOR SELECT TO authenticated USING (true);

-- Helper view: change activity summary by hour (for timeline UI)
CREATE OR REPLACE VIEW dr_change_log_activity AS
SELECT
  date_trunc('hour', changed_at) AS hour,
  table_name,
  operation,
  COUNT(*) AS change_count
FROM dr_change_log
GROUP BY 1, 2, 3
ORDER BY 1 DESC;
