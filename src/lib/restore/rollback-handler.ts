import { SupabaseClient } from '@supabase/supabase-js'
import { createSnapshot } from '@/lib/backup/snapshot-manager'
import { restoreSnapshot } from './restore-executor'
import type { Snapshot } from '@/lib/types/snapshot'
import { env } from '@/env'

export async function createSafetySnapshot(
  client: SupabaseClient,
  restoreLogId: string
): Promise<Snapshot> {
  const snapshot = await createSnapshot(client, {
    name: `safety-before-restore-${restoreLogId.slice(0, 8)}`,
    description: `Auto-created safety snapshot before restore operation ${restoreLogId}`,
    snapshot_type: 'safety',
  })

  // Store the safety snapshot ID on the restore log
  await client
    .from('dr_restore_logs')
    .update({ safety_snapshot_id: snapshot.id })
    .eq('id', restoreLogId)

  return snapshot
}

export async function rollbackRestore(
  client: SupabaseClient,
  restoreLogId: string
): Promise<void> {
  // Get the restore log to find the safety snapshot
  const { data: restoreLog, error } = await client
    .from('dr_restore_logs')
    .select('*')
    .eq('id', restoreLogId)
    .single()

  if (error || !restoreLog) {
    throw new Error(`Restore log not found: ${restoreLogId}`)
  }

  if (!restoreLog.safety_snapshot_id) {
    throw new Error('No safety snapshot available for rollback')
  }

  // Get the safety snapshot
  const { data: safetySnapshot, error: snapError } = await client
    .from('dr_snapshots')
    .select('*')
    .eq('id', restoreLog.safety_snapshot_id)
    .single()

  if (snapError || !safetySnapshot) {
    throw new Error('Safety snapshot not found')
  }

  // Mark restore log as rolling back
  await client
    .from('dr_restore_logs')
    .update({ status: 'in_progress', auto_rolled_back: true })
    .eq('id', restoreLogId)

  try {
    // Execute the rollback by restoring from safety snapshot
    const tables = safetySnapshot.tables_included as string[] ?? env.BACKUP_TABLES
    await restoreSnapshot(client, safetySnapshot.id, tables)

    // Mark as rolled back
    await client
      .from('dr_restore_logs')
      .update({ status: 'rolled_back', completed_at: new Date().toISOString() })
      .eq('id', restoreLogId)
  } catch (rollbackError) {
    await client
      .from('dr_restore_logs')
      .update({
        status: 'failed',
        error_message: `Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`,
      })
      .eq('id', restoreLogId)
    throw rollbackError
  }
}
