import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executePITR } from '@/lib/restore/pitr-executor'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { target_timestamp } = body

  if (!target_timestamp) {
    return NextResponse.json({ error: 'target_timestamp is required (ISO string)' }, { status: 400 })
  }

  const drDb = createAdminClient()

  // Create a restore log entry
  const { data: restoreLog, error: logErr } = await drDb
    .from('dr_restore_logs')
    .insert({
      restore_type:       'pitr',
      target_timestamp,
      status:             'in_progress',
      initiated_by:       'ui',
      started_at:         new Date().toISOString(),
    })
    .select()
    .single()

  if (logErr || !restoreLog) {
    return NextResponse.json({ error: 'Failed to create restore log', detail: logErr?.message }, { status: 500 })
  }

  // Create a safety snapshot record (log it; actual snapshot created by backup trigger)
  await drDb.from('dr_snapshots').insert({
    name:               `safety-before-pitr-${Date.now()}`,
    snapshot_type:      'safety',
    status:             'in_progress',
    snapshot_timestamp: new Date().toISOString(),
    tables_included:    [],
  })

  // Execute PITR
  const result = await executePITR({
    targetTimestamp: target_timestamp,
    onProgress: async (msg, percent) => {
      await drDb
        .from('dr_restore_logs')
        .update({ notes: msg, progress_percent: percent } as any)
        .eq('id', restoreLog.id)
    },
  })

  // Update restore log with final result
  await drDb.from('dr_restore_logs').update({
    status:            result.success ? 'completed' : 'failed',
    completed_at:      new Date().toISOString(),
    snapshot_id:       result.baseSnapshotId || null,
    tables_restored:   result.tablesRestored,
    records_restored:  result.recordsRestored,
    error_message:     result.errors.length > 0 ? result.errors.join('; ') : null,
    restore_metadata:  {
      pitr:              true,
      base_snapshot_id:  result.baseSnapshotId,
      base_snapshot_time: result.baseSnapshotTime,
      target_time:       result.targetTime,
      nearest_change_at: result.nearestChangeAt,
      changes_replayed:  result.changesReplayed,
      errors:            result.errors,
    },
  } as any).eq('id', restoreLog.id)

  return NextResponse.json({
    success:            result.success,
    restore_log_id:     restoreLog.id,
    base_snapshot_id:   result.baseSnapshotId,
    base_snapshot_time: result.baseSnapshotTime,
    target_time:        result.targetTime,
    nearest_change_at:  result.nearestChangeAt,
    tables_restored:    result.tablesRestored,
    records_restored:   result.recordsRestored,
    changes_replayed:   result.changesReplayed,
    errors:             result.errors.length > 0 ? result.errors : undefined,
  }, { status: result.success ? 200 : 207 })
}
