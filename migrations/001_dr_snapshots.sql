-- DR: Snapshot registry table
-- Tracks every backup snapshot taken of the timesheet database

CREATE TABLE IF NOT EXISTS dr_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  snapshot_type VARCHAR(50) NOT NULL DEFAULT 'full', -- 'full', 'incremental', 'manual', 'safety'
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
  storage_path VARCHAR(500),
  storage_size_bytes BIGINT DEFAULT 0,
  data_hash VARCHAR(64),
  snapshot_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tables_included JSONB DEFAULT '[]'::jsonb,
  record_counts JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_snapshot_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  CONSTRAINT valid_snapshot_type CHECK (snapshot_type IN ('full', 'incremental', 'manual', 'safety'))
);

CREATE INDEX IF NOT EXISTS idx_dr_snapshots_status ON dr_snapshots(status);
CREATE INDEX IF NOT EXISTS idx_dr_snapshots_created ON dr_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dr_snapshots_timestamp ON dr_snapshots(snapshot_timestamp DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_dr_snapshots_updated_at
  BEFORE UPDATE ON dr_snapshots
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable RLS
ALTER TABLE dr_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage snapshots" ON dr_snapshots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE dr_snapshots IS 'Registry of all database backup snapshots for the timesheet DR system';
