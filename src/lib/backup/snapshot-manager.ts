import { SupabaseClient } from '@supabase/supabase-js'
import { extractTable, getAllTableCounts } from './table-extractor'
import { ensureBucketExists, uploadTableSnapshot, uploadSnapshotMetadata, getSnapshotStorageSize } from './storage-handler'
import type { Snapshot, CreateSnapshotRequest, SnapshotMetadata } from '@/lib/types/snapshot'
import type { BackupJob } from '@/lib/types/job'
import { generateSnapshotName } from '@/lib/utils'
import { env } from '@/env'

export interface SnapshotProgress {
  snapshot_id: string
  phase: 'initializing' | 'counting' | 'extracting' | 'uploading' | 'finalizing'
  current_table?: string
  tables_done: number
  tables_total: number
  records_done: number
  progress_percent: number
}

export async function createSnapshot(
  client: SupabaseClient,
  request: CreateSnapshotRequest = {},
  jobId?: string,
  onProgress?: (progress: SnapshotProgress) => Promise<void>
): Promise<Snapshot> {
  const tables = request.tables ?? env.BACKUP_TABLES
  const name = request.name ?? generateSnapshotName()

  // 1. Create snapshot record
  const { data: snapshot, error: createError } = await client
    .from('dr_snapshots')
    .insert({
      name,
      description: request.description,
      snapshot_type: request.snapshot_type ?? 'manual',
      status: 'in_progress',
      tables_included: tables,
      record_counts: {},
    })
    .select()
    .single()

  if (createError || !snapshot) {
    throw new Error(`Failed to create snapshot record: ${createError?.message}`)
  }

  try {
    // 2. Ensure storage bucket exists
    await ensureBucketExists(client)

    // 3. Count all tables
    await onProgress?.({
      snapshot_id: snapshot.id,
      phase: 'counting',
      tables_done: 0,
      tables_total: tables.length,
      records_done: 0,
      progress_percent: 5,
    })

    const recordCounts = await getAllTableCounts(client, tables)

    // 4. Extract and upload each table
    let tablesDone = 0
    let totalRecordsDone = 0

    for (const tableName of tables) {
      await onProgress?.({
        snapshot_id: snapshot.id,
        phase: 'extracting',
        current_table: tableName,
        tables_done: tablesDone,
        tables_total: tables.length,
        records_done: totalRecordsDone,
        progress_percent: Math.round(10 + (tablesDone / tables.length) * 75),
      })

      const tableData = await extractTable(client, tableName, 1000, (done, total) => {
        onProgress?.({
          snapshot_id: snapshot.id,
          phase: 'extracting',
          current_table: tableName,
          tables_done: tablesDone,
          tables_total: tables.length,
          records_done: totalRecordsDone + done,
          progress_percent: Math.round(10 + ((tablesDone + done / total) / tables.length) * 75),
        })
      })

      await uploadTableSnapshot(client, snapshot.id, tableData)
      tablesDone++
      totalRecordsDone += tableData.total_rows
    }

    // 5. Upload metadata
    const metadata: SnapshotMetadata = {
      snapshot_id: snapshot.id,
      snapshot_timestamp: new Date().toISOString(),
      tables,
      record_counts: recordCounts,
      total_size_bytes: 0,
      schema_version: 1,
      app_version: '1.0.0',
    }

    await onProgress?.({
      snapshot_id: snapshot.id,
      phase: 'finalizing',
      tables_done: tables.length,
      tables_total: tables.length,
      records_done: totalRecordsDone,
      progress_percent: 90,
    })

    await uploadSnapshotMetadata(client, snapshot.id, metadata)
    const storageSize = await getSnapshotStorageSize(client, snapshot.id)

    // 6. Mark snapshot as completed
    const { data: completed, error: updateError } = await client
      .from('dr_snapshots')
      .update({
        status: 'completed',
        storage_size_bytes: storageSize,
        record_counts: recordCounts,
        snapshot_timestamp: new Date().toISOString(),
      })
      .eq('id', snapshot.id)
      .select()
      .single()

    if (updateError) throw new Error(`Failed to finalize snapshot: ${updateError.message}`)

    await onProgress?.({
      snapshot_id: snapshot.id,
      phase: 'finalizing',
      tables_done: tables.length,
      tables_total: tables.length,
      records_done: totalRecordsDone,
      progress_percent: 100,
    })

    return completed as Snapshot
  } catch (error) {
    // Mark as failed
    await client
      .from('dr_snapshots')
      .update({ status: 'failed' })
      .eq('id', snapshot.id)

    throw error
  }
}

export async function listSnapshots(
  client: SupabaseClient,
  page = 1,
  pageSize = 20
): Promise<{ snapshots: Snapshot[]; total: number }> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await client
    .from('dr_snapshots')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(`Failed to list snapshots: ${error.message}`)
  return { snapshots: (data ?? []) as Snapshot[], total: count ?? 0 }
}

export async function getSnapshot(
  client: SupabaseClient,
  id: string
): Promise<Snapshot | null> {
  const { data, error } = await client
    .from('dr_snapshots')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Snapshot
}
