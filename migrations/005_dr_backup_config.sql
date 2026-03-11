-- DR: Backup configuration
-- Stores schedule, retention policy, and notification settings

CREATE TABLE IF NOT EXISTS dr_backup_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_name VARCHAR(255) NOT NULL UNIQUE DEFAULT 'default',
  is_active BOOLEAN DEFAULT true,

  -- Backup schedule
  backup_enabled BOOLEAN DEFAULT true,
  schedule_cron VARCHAR(100) DEFAULT '0 2 * * *',
  -- Default: 2am daily
  schedule_description VARCHAR(255) DEFAULT 'Daily at 2:00 AM',

  -- Retention policy
  retention_days INT DEFAULT 30,
  retention_versions INT DEFAULT 10,
  -- Keep minimum N versions regardless of age

  -- Table configuration
  included_tables JSONB DEFAULT '["timesheets","employees","projects","clients","time_entries"]'::jsonb,
  excluded_tables JSONB DEFAULT '[]'::jsonb,

  -- Backup options
  enable_compression BOOLEAN DEFAULT true,
  compression_level INT DEFAULT 6 CHECK (compression_level >= 1 AND compression_level <= 9),
  batch_size INT DEFAULT 1000,
  -- Rows per batch when reading tables

  -- Verification options
  auto_verify BOOLEAN DEFAULT true,
  verify_row_counts BOOLEAN DEFAULT true,
  verify_checksums BOOLEAN DEFAULT false,
  -- Expensive, off by default

  -- Notification settings
  notify_on_success BOOLEAN DEFAULT false,
  notify_on_failure BOOLEAN DEFAULT true,
  notification_emails JSONB DEFAULT '[]'::jsonb,
  webhook_url VARCHAR(500),

  -- Agent config
  max_concurrent_backups INT DEFAULT 1,
  backup_timeout_minutes INT DEFAULT 60,

  -- Metadata
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_dr_backup_config_updated_at
  BEFORE UPDATE ON dr_backup_config
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE dr_backup_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage config" ON dr_backup_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default configuration
INSERT INTO dr_backup_config (config_name, is_active)
VALUES ('default', true)
ON CONFLICT (config_name) DO NOTHING;

COMMENT ON TABLE dr_backup_config IS 'Configuration for backup schedule, retention, and notifications';

-- Combined view for dashboard metrics
CREATE OR REPLACE VIEW dr_dashboard_metrics AS
SELECT
  (SELECT COUNT(*) FROM dr_snapshots WHERE status = 'completed') AS total_snapshots,
  (SELECT MAX(snapshot_timestamp) FROM dr_snapshots WHERE status = 'completed') AS last_backup_at,
  (SELECT SUM(storage_size_bytes) FROM dr_snapshots WHERE status = 'completed') AS total_storage_bytes,
  (SELECT COUNT(*) FROM dr_backup_jobs WHERE status = 'queued') AS queued_jobs,
  (SELECT COUNT(*) FROM dr_backup_jobs WHERE status = 'in_progress') AS active_jobs,
  (SELECT COUNT(*) FROM dr_agent_registry WHERE status = 'online') AS online_agents,
  (SELECT COUNT(*) FROM dr_restore_logs WHERE status = 'completed' AND created_at > NOW() - INTERVAL '30 days') AS restores_last_30_days,
  (SELECT COUNT(*) FROM dr_restore_logs WHERE status = 'failed' AND created_at > NOW() - INTERVAL '30 days') AS failed_restores_last_30_days;
