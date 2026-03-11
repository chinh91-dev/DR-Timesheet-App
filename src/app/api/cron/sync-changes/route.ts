import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSourceClient } from '@/lib/supabase/source'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Batch size — how many change log entries to pull per sync run
const SYNC_BATCH_SIZE = 5000

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const drDb  = createAdminClient()
  const srcDb = createSourceClient()

  // 1. Read last synced checkpoint
  const { data: checkpoint, error: cpErr } = await drDb
    .from('dr_pitr_checkpoints')
    .select('*')
    .eq('source_label', 'time-team-tracker')
    .single()

  if (cpErr || !checkpoint) {
    return NextResponse.json({ error: 'Checkpoint not found. Run migration 007 on DR DB.' }, { status: 500 })
  }

  const lastSyncedId: number = checkpoint.last_synced_id ?? 0

  // 2. Pull new change log entries from source DB
  const { data: newEntries, error: fetchErr } = await srcDb
    .from('change_log')
    .select('*')
    .gt('id', lastSyncedId)
    .order('id', { ascending: true })
    .limit(SYNC_BATCH_SIZE)

  if (fetchErr) {
    return NextResponse.json({
      error: 'Failed to read change_log from source DB',
      detail: fetchErr.message,
      hint: 'Have you run migration 006 on the time-team-tracker database?',
    }, { status: 500 })
  }

  if (!newEntries || newEntries.length === 0) {
    // Nothing new — update last_sync_run_at and return
    await drDb
      .from('dr_pitr_checkpoints')
      .update({ last_sync_run_at: new Date().toISOString() })
      .eq('source_label', 'time-team-tracker')

    return NextResponse.json({
      synced: 0,
      message: 'No new changes since last sync',
      last_synced_id: lastSyncedId,
    })
  }

  // 3. Insert into dr_change_log (ignore duplicates via ON CONFLICT)
  const rows = newEntries.map((e: any) => ({
    source_id:      e.id,
    changed_at:     e.changed_at,
    table_name:     e.table_name,
    operation:      e.operation,
    row_id:         e.row_id,
    new_data:       e.new_data,
    old_data:       e.old_data,
    transaction_id: e.transaction_id,
  }))

  const { error: insertErr } = await drDb
    .from('dr_change_log')
    .upsert(rows, { onConflict: 'source_id', ignoreDuplicates: true })

  if (insertErr) {
    return NextResponse.json({
      error: 'Failed to insert into dr_change_log',
      detail: insertErr.message,
    }, { status: 500 })
  }

  // 4. Update checkpoint to highest ID synced
  const maxId       = newEntries[newEntries.length - 1].id
  const maxChangedAt = newEntries[newEntries.length - 1].changed_at

  await drDb
    .from('dr_pitr_checkpoints')
    .update({
      last_synced_id:       maxId,
      last_synced_at:       maxChangedAt,
      last_sync_run_at:     new Date().toISOString(),
      total_entries_synced: (checkpoint.total_entries_synced ?? 0) + newEntries.length,
    })
    .eq('source_label', 'time-team-tracker')

  const hasMore = newEntries.length === SYNC_BATCH_SIZE

  return NextResponse.json({
    synced:          newEntries.length,
    last_synced_id:  maxId,
    last_changed_at: maxChangedAt,
    has_more:        hasMore,
    message:         hasMore
      ? `Synced ${newEntries.length} entries. More entries pending — cron will continue next run.`
      : `Synced ${newEntries.length} entries. Change log is up to date.`,
  })
}
