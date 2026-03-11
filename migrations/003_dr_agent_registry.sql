-- DR: Agent registry
-- Tracks all active agent workers and their health

CREATE TABLE IF NOT EXISTS dr_agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type VARCHAR(50) NOT NULL,
  -- 'backup_agent', 'restore_agent', 'verify_agent', 'notify_agent'
  agent_name VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'offline',
  -- 'online', 'offline', 'degraded', 'error', 'starting'
  last_heartbeat TIMESTAMPTZ,
  heartbeat_interval_seconds INT DEFAULT 30,
  current_job_id UUID REFERENCES dr_backup_jobs(id) ON DELETE SET NULL,
  current_jobs INT DEFAULT 0,
  max_concurrent_jobs INT DEFAULT 3,
  jobs_completed INT DEFAULT 0,
  jobs_failed INT DEFAULT 0,
  agent_version VARCHAR(50) DEFAULT '1.0.0',
  host VARCHAR(255),
  pid INT,
  metadata JSONB DEFAULT '{}'::jsonb,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_agent_type CHECK (agent_type IN ('backup_agent', 'restore_agent', 'verify_agent', 'notify_agent')),
  CONSTRAINT valid_agent_status CHECK (status IN ('online', 'offline', 'degraded', 'error', 'starting'))
);

CREATE INDEX IF NOT EXISTS idx_dr_agent_registry_type ON dr_agent_registry(agent_type);
CREATE INDEX IF NOT EXISTS idx_dr_agent_registry_status ON dr_agent_registry(status);
CREATE INDEX IF NOT EXISTS idx_dr_agent_registry_heartbeat ON dr_agent_registry(last_heartbeat DESC);

CREATE TRIGGER update_dr_agent_registry_updated_at
  BEFORE UPDATE ON dr_agent_registry
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE dr_agent_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view agents" ON dr_agent_registry
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-mark agents as offline if heartbeat is stale (>2 minutes)
-- This view is used by the UI to show agent health
CREATE OR REPLACE VIEW dr_agents_health AS
SELECT
  *,
  CASE
    WHEN last_heartbeat IS NULL THEN 'offline'
    WHEN last_heartbeat < NOW() - INTERVAL '2 minutes' THEN 'offline'
    WHEN last_heartbeat < NOW() - INTERVAL '1 minute' THEN 'degraded'
    ELSE status
  END AS computed_status,
  CASE
    WHEN last_heartbeat IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::INT
  END AS seconds_since_heartbeat
FROM dr_agent_registry;

COMMENT ON TABLE dr_agent_registry IS 'Registry of all agent worker processes';
