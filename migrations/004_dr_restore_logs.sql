-- DR: Restore operation audit log
-- Records every restore/rollback operation for compliance and debugging

CREATE TABLE IF NOT EXISTS dr_restore_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restore_id UUID UNIQUE DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES dr_snapshots(id) ON DELETE SET NULL,
  job_id UUID REFERENCES dr_backup_jobs(id) ON DELETE SET NULL,
  restore_type VARCHAR(50) NOT NULL,
  -- 'snapshot', 'point_in_time', 'rollback', 'safety_rollback'
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- 'pending', 'validating', 'in_progress', 'completed', 'failed', 'rolled_back'
  target_timestamp TIMESTAMPTZ,
  safety_snapshot_id UUID REFERENCES dr_snapshots(id) ON DELETE SET NULL,
  -- ID of the auto-created safety snapshot taken before this restore
  progress_percent INT DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  current_table VARCHAR(255),
  tables_processed INT DEFAULT 0,
  tables_total INT DEFAULT 0,
  records_inserted BIGINT DEFAULT 0,
  records_deleted BIGINT DEFAULT 0,
  rows_affected JSONB DEFAULT '{}'::jsonb,
  -- {table_name: {inserted: N, deleted: N}}
  validation_passed BOOLEAN,
  validation_errors JSONB DEFAULT '[]'::jsonb,
  validation_summary JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  error_at_table VARCHAR(255),
  auto_rolled_back BOOLEAN DEFAULT false,
  -- true if system auto-rolled back due to validation failure
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INT,
  initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  approval_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_restore_type CHECK (restore_type IN ('snapshot', 'point_in_time', 'rollback', 'safety_rollback')),
  CONSTRAINT valid_restore_status CHECK (status IN ('pending', 'validating', 'in_progress', 'completed', 'failed', 'rolled_back'))
);

CREATE INDEX IF NOT EXISTS idx_dr_restore_logs_status ON dr_restore_logs(status);
CREATE INDEX IF NOT EXISTS idx_dr_restore_logs_snapshot ON dr_restore_logs(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_dr_restore_logs_created ON dr_restore_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dr_restore_logs_initiated ON dr_restore_logs(initiated_by);

CREATE TRIGGER update_dr_restore_logs_updated_at
  BEFORE UPDATE ON dr_restore_logs
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE dr_restore_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage restore logs" ON dr_restore_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE dr_restore_logs IS 'Audit trail for all restore and rollback operations';
