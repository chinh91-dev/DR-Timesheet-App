import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSourceClient } from '@/lib/supabase/source'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return authHeader === `Bearer ${cronSecret}`
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { restore_log_id } = await req.json()
  if (!restore_log_id) {
    return NextResponse.json({ error: 'restore_log_id is required' }, { status: 400 })
  }

  const drDb = createAdminClient()
  const sourceDb = createSourceClient()

  // Get the restore log
  const { data: restoreLog, error: logError } = await drDb
    .from('dr_restore_logs')
    .select('*, dr_snapshots(*)')
    .eq('id', restore_log_id)
    .single()

  if (logError || !restoreLog) {
    return NextResponse.json({ error: 'Restore log not found' }, { status: 404 })
  }

  // Mark as in progress
  await drDb.from('dr_restore_logs').update({
    status: 'in_progress',
    started_at: new Date().toISOString(),
  }).eq('id', restore_log_id)

  // Load snapshot data from storage
  const storageBucket = process.env.DR_STORAGE_BUCKET ?? 'dr-backups'
  const snapshotId = restoreLog.snapshot_id

  const { data: fileData, error: downloadError } = await drDb.storage
    .from(storageBucket)
    .download(`${snapshotId}/_snapshot.json`)

  if (downloadError || !fileData) {
    await drDb.from('dr_restore_logs').update({
      status: 'failed',
      error_message: `Failed to download snapshot: ${downloadError?.message}`,
    }).eq('id', restore_log_id)
    return NextResponse.json({ error: 'Failed to download snapshot data' }, { status: 500 })
  }

  const snapshotText = await fileData.text()
  const snapshotPayload = JSON.parse(snapshotText)
  const { data: tableData, record_counts: recordCounts } = snapshotPayload

  const rowsAffected: Record<string, { inserted: number; deleted: number }> = {}
  const errors: string[] = []
  const tables = Object.keys(tableData)

  await drDb.from('dr_restore_logs').update({
    tables_total: tables.length,
    status: 'in_progress',
  }).eq('id', restore_log_id)

  // Restore each table to the SOURCE database
  for (let i = 0; i < tables.length; i++) {
    const tableName = tables[i]
    const rows = tableData[tableName] as unknown[]

    try {
      // Update progress
      await drDb.from('dr_restore_logs').update({
        current_table: tableName,
        tables_processed: i,
        progress_percent: Math.round((i / tables.length) * 100),
      }).eq('id', restore_log_id)

      // Delete existing rows
      const { count: deleteCount } = await sourceDb
        .from(tableName)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // delete all (Supabase requires a filter)

      // Insert rows in batches of 500
      let insertedCount = 0
      const BATCH_SIZE = 500
      for (let b = 0; b < rows.length; b += BATCH_SIZE) {
        const batch = rows.slice(b, b + BATCH_SIZE)
        const { error: insertError } = await sourceDb.from(tableName).insert(batch)
        if (insertError) {
          errors.push(`${tableName} insert batch ${b}: ${insertError.message}`)
          break
        }
        insertedCount += batch.length
      }

      rowsAffected[tableName] = { inserted: insertedCount, deleted: deleteCount ?? 0 }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`${tableName}: ${message}`)
    }
  }

  const finalStatus = errors.length === 0 ? 'completed' : 'failed'
  const totalInserted = Object.values(rowsAffected).reduce((a, b) => a + b.inserted, 0)

  await drDb.from('dr_restore_logs').update({
    status: finalStatus,
    progress_percent: 100,
    tables_processed: tables.length,
    records_inserted: totalInserted,
    rows_affected: rowsAffected,
    validation_passed: errors.length === 0,
    validation_errors: errors,
    completed_at: new Date().toISOString(),
    error_message: errors.length > 0 ? errors.join('; ') : null,
  }).eq('id', restore_log_id)

  return NextResponse.json({
    success: finalStatus === 'completed',
    tables_restored: tables.length,
    total_records_inserted: totalInserted,
    errors: errors.length > 0 ? errors : undefined,
  })
}
