export type SnapshotStatus = 'pending' | 'in_progress' | 'completed' | 'failed'
export type SnapshotType = 'full' | 'incremental' | 'manual' | 'safety'

export interface Snapshot {
  id: string
  name: string
  description?: string
  snapshot_type: SnapshotType
  status: SnapshotStatus
  storage_path?: string
  storage_size_bytes: number
  data_hash?: string
  snapshot_timestamp: string
  tables_included: string[]
  record_counts: Record<string, number>
  created_by?: string
  created_at: string
  updated_at: string
}

export interface SnapshotTableData {
  table_name: string
  schema_version: number
  snapshot_timestamp: string
  total_rows: number
  columns: ColumnDefinition[]
  rows: Record<string, unknown>[]
}

export interface ColumnDefinition {
  name: string
  type: string
  nullable: boolean
  default?: string
}

export interface SnapshotMetadata {
  snapshot_id: string
  snapshot_timestamp: string
  tables: string[]
  record_counts: Record<string, number>
  total_size_bytes: number
  schema_version: number
  app_version: string
}

export interface CreateSnapshotRequest {
  name?: string
  description?: string
  snapshot_type?: SnapshotType
  tables?: string[]
}
