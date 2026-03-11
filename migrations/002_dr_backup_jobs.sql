-- DR: Backup job queue
-- Used by agents to pick up and process backup/restore tasks

CREATE TABLE IF NOT EXISTS dr_backup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES dr_snapshots(id) ON DELETE CASCADE,
  agent_id UUID,
  agent_name VARCHAR(255),
  job_type VARCHAR(50) NOT NULL DEFAULT 'full_backup',
  -- 'full_backup', 'incremental_backup', 'verify_backup', 'restore', 'rollback', 'cleanup'
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  -- 'queued', 'in_progress', 'completed', 'failed', 'cancelled', 'retrying'
  priority INT DEFAULT 100,
  progress_percent INT DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  current_step VARCHAR(255),
  total_steps INT DEFAULT 1,
  current_step_number INT DEFAULT 0,
  tables_processed INT DEFAULT 0,
  tables_total INT DEFAULT 0,
  records_processed BIGINT DEFAULT 0,
  error_code VARCHAR(100),
  error_message TEXT,
  error_stack TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  result JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_job_status CHECK (status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled', 'retrying')),
  CONSTRAINT valid_job_type CHECK (job_type IN ('full_backup', 'incremental_backup', 'verify_backup', 'restore', 'rollback', 'cleanup'))
);

CREATE INDEX IF NOT EXISTS idx_dr_backup_jobs_status ON dr_backup_jobs(status);
CREATE INDEX IF NOT EXISTS idx_dr_backup_jobs_snapshot ON dr_backup_jobs(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_dr_backup_jobs_agent ON dr_backup_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_dr_backup_jobs_type_status ON dr_backup_jobs(job_type, status);
CREATE INDEX IF NOT EXISTS idx_dr_backup_jobs_created ON dr_backup_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dr_backup_jobs_priority ON dr_backup_jobs(priority DESC, created_at ASC);

CREATE TRIGGER update_dr_backup_jobs_updated_at
  BEFORE UPDATE ON dr_backup_jobs
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE dr_backup_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage jobs" ON dr_backup_jobs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE dr_backup_jobs IS 'Job queue for backup/restore agent workers';
