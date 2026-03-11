export type AgentType = 'backup_agent' | 'restore_agent' | 'verify_agent' | 'notify_agent'
export type AgentStatus = 'online' | 'offline' | 'degraded' | 'error' | 'starting'

export interface Agent {
  id: string
  agent_type: AgentType
  agent_name: string
  status: AgentStatus
  last_heartbeat?: string
  heartbeat_interval_seconds: number
  current_job_id?: string
  current_jobs: number
  max_concurrent_jobs: number
  jobs_completed: number
  jobs_failed: number
  agent_version: string
  host?: string
  pid?: number
  metadata: Record<string, unknown>
  last_error?: string
  last_error_at?: string
  created_at: string
  updated_at: string
  // From dr_agents_health view
  computed_status?: AgentStatus
  seconds_since_heartbeat?: number
}

export interface AgentHeartbeat {
  agent_name: string
  agent_type: AgentType
  status: AgentStatus
  current_jobs: number
  pid?: number
  metadata?: Record<string, unknown>
}
