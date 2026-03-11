export type RestoreType = 'snapshot' | 'point_in_time' | 'rollback' | 'safety_rollback'
export type RestoreStatus = 'pending' | 'validating' | 'in_progress' | 'completed' | 'failed' | 'rolled_back'

export interface RestoreLog {
  id: string
  restore_id: string
  snapshot_id?: string
  job_id?: string
  restore_type: RestoreType
  status: RestoreStatus
  target_timestamp?: string
  safety_snapshot_id?: string
  progress_percent: number
  current_table?: string
  tables_processed: number
  tables_total: number
  records_inserted: number
  records_deleted: number
  rows_affected: Record<string, { inserted: number; deleted: number }>
  validation_passed?: boolean
  validation_errors: string[]
  validation_summary: Record<string, unknown>
  error_message?: string
  error_at_table?: string
  auto_rolled_back: boolean
  started_at?: string
  completed_at?: string
  duration_seconds?: number
  initiated_by?: string
  confirmed_at?: string
  approval_notes?: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface RestoreRequest {
  snapshot_id: string
  restore_type: RestoreType
  target_timestamp?: string
  approval_notes?: string
  tables?: string[]  // Restore only specific tables
}

export interface RestoreValidation {
  is_valid: boolean
  snapshot_exists: boolean
  storage_accessible: boolean
  tables_available: string[]
  estimated_records: Record<string, number>
  warnings: string[]
  errors: string[]
}

export interface WizardStep {
  id: number
  title: string
  description: string
  completed: boolean
  active: boolean
}
