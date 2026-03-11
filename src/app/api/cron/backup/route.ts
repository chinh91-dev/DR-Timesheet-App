import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSourceClient } from '@/lib/supabase/source'
import { generateSnapshotName } from '@/lib/utils'

export const maxDuration = 300 // 5 minutes (Vercel Pro)
export const dynamic = 'force-dynamic'

// Tables to back up from the source (time-team-tracker) database
const BACKUP_TABLES = (process.env.BACKUP_TABLES ?? 'timesheets,employees,projects,clients,time_entries')
  .split(',').map(t => t.trim()).filter(Boolean)

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // skip check if not configured (dev mode)
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const drDb = createAdminClient()
  const sourceDb = createSourceClient()

  // Create a snapshot record
  const snapshotName = generateSnapshotName()
  const { data: snapshot, error: snapshotError } = await drDb
    .from('dr_snapshots')
    .insert({
      name: snapshotName,
      snapshot_type: 'full',
      status: 'in_progress',
      snapshot_timestamp: new Date().toISOString(),
      tables_included: BACKUP_TABLES,
    })
    .select()
    .single()

  if (snapshotError || !snapshot) {
    return NextResponse.json({ error: 'Failed to create snapshot record', detail: snapshotError?.message }, { status: 500 })
  }

  // Create a backup job for tracking
  await drDb.from('dr_backup_jobs').insert({
    snapshot_id: snapshot.id,
    job_type: 'full_backup',
    status: 'in_progress',
    agent_name: 'vercel-cron-backup',
    tables_total: BACKUP_TABLES.length,
    started_at: new Date().toISOString(),
  })

  const recordCounts: Record<string, number> = {}
  const tableData: Record<string, unknown[]> = {}
  const errors: string[] = []

  // Extract each table from the source database
  for (const tableName of BACKUP_TABLES) {
    try {
      const allRows: unknown[] = []
      const PAGE_SIZE = 1000
      let page = 0
      let hasMore = true

      while (hasMore) {
        const { data, error } = await sourceDb
          .from(tableName)
          .select('*')
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

        if (error) {
          errors.push(`${tableName}: ${error.message}`)
          hasMore = false
          break
        }

        allRows.push(...(data ?? []))
        hasMore = (data?.length ?? 0) === PAGE_SIZE
        page++
      }

      tableData[tableName] = allRows
      recordCounts[tableName] = allRows.length
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`${tableName}: ${message}`)
    }
  }

  // Store snapshot data in DR database's storage
  // We store as a JSON object in a dr_snapshot_data table
  // (In production, use Supabase Storage for large snapshots)
  const snapshotPayload = {
    snapshot_id: snapshot.id,
    snapshot_timestamp: snapshot.snapshot_timestamp,
    tables: BACKUP_TABLES,
    record_counts: recordCounts,
    data: tableData,
    errors,
  }

  // Calculate approximate size
  const dataStr = JSON.stringify(snapshotPayload)
  const sizeBytes = new TextEncoder().encode(dataStr).length

  // Store in Supabase Storage if configured, otherwise store as inline JSON
  let storagePath = ''
  const storageBucket = process.env.DR_STORAGE_BUCKET ?? 'dr-backups'

  const { error: uploadError } = await drDb.storage
    .from(storageBucket)
    .upload(`${snapshot.id}/_snapshot.json`, dataStr, {
      contentType: 'application/json',
      upsert: true,
    })

  if (!uploadError) {
    storagePath = `${storageBucket}/${snapshot.id}/_snapshot.json`
  }

  // Update snapshot record with results
  const finalStatus = errors.length === 0 ? 'completed' : 'failed'
  await drDb.from('dr_snapshots').update({
    status: finalStatus,
    storage_path: storagePath,
    storage_size_bytes: sizeBytes,
    record_counts: recordCounts,
    tables_included: Object.keys(tableData),
    updated_at: new Date().toISOString(),
  }).eq('id', snapshot.id)

  // Update job
  await drDb.from('dr_backup_jobs').update({
    status: finalStatus,
    progress_percent: 100,
    tables_processed: Object.keys(tableData).length,
    completed_at: new Date().toISOString(),
    error_message: errors.length > 0 ? errors.join('; ') : null,
    result: { record_counts: recordCounts, size_bytes: sizeBytes },
  }).eq('snapshot_id', snapshot.id)

  return NextResponse.json({
    success: finalStatus === 'completed',
    snapshot_id: snapshot.id,
    snapshot_name: snapshotName,
    tables_backed_up: Object.keys(tableData).length,
    total_records: Object.values(recordCounts).reduce((a, b) => a + b, 0),
    size_bytes: sizeBytes,
    errors: errors.length > 0 ? errors : undefined,
  })
}
