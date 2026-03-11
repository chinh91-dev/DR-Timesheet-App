export type JobStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'retrying'
export type JobType = 'full_backup' | 'incremental_backup' | 'verify_backup' | 'restore' | 'rollback' | 'cleanup'

export interface BackupJob {
  id: string
  snapshot_id?: string
  agent_id?: string
  agent_name?: string
  job_type: JobType
  status: JobStatus
  priority: number
  progress_percent: number
  current_step?: string
  total_steps: number
  current_step_number: number
  tables_processed: number
  tables_total: number
  records_processed: number
  error_code?: string
  error_message?: string
  started_at?: string
  completed_at?: string
  duration_seconds?: number
  retry_count: number
  max_retries: number
  next_retry_at?: string
  metadata: Record<string, unknown>
  result: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface JobProgress {
  job_id: string
  status: JobStatus
  progress_percent: number
  current_step?: string
  tables_processed: number
  tables_total: number
  records_processed: number
  error_message?: string
  updated_at: string
}
