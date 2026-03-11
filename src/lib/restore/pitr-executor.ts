import { createAdminClient } from '@/lib/supabase/admin'
import { createSourceClient } from '@/lib/supabase/source'

export interface PITROptions {
  targetTimestamp: string          // ISO timestamp — restore to this exact moment
  tables?: string[]                // optional: only restore these tables
  onProgress?: (msg: string, percent: number) => void
}

export interface PITRResult {
  success: boolean
  baseSnapshotId: string
  baseSnapshotTime: string
  targetTime: string
  tablesRestored: number
  recordsRestored: number
  changesReplayed: number
  nearestChangeAt: string | null   // actual timestamp of last change replayed
  errors: string[]
}

export async function executePITR(options: PITROptions): Promise<PITRResult> {
  const { targetTimestamp, tables, onProgress } = options
  const drDb  = createAdminClient()
  const srcDb = createSourceClient()
  const errors: string[] = []

  const progress = (msg: string, pct: number) => onProgress?.(msg, pct)

  // ── Step 1: Find the best base snapshot (most recent full snapshot before target) ──
  progress('Finding base snapshot before target time…', 5)

  const { data: baseSnapshot, error: snapErr } = await drDb
    .from('dr_snapshots')
    .select('*')
    .eq('status', 'completed')
    .lte('snapshot_timestamp', targetTimestamp)
    .order('snapshot_timestamp', { ascending: false })
    .limit(1)
    .single()

  if (snapErr || !baseSnapshot) {
    return {
      success: false,
      baseSnapshotId: '',
      baseSnapshotTime: '',
      targetTime: targetTimestamp,
      tablesRestored: 0,
      recordsRestored: 0,
      changesReplayed: 0,
      nearestChangeAt: null,
      errors: ['No completed snapshot found before the target timestamp. Create a full backup first.'],
    }
  }

  progress(`Base snapshot found: ${baseSnapshot.name} (${baseSnapshot.snapshot_timestamp})`, 10)

  // ── Step 2: Load change log entries between snapshot time and target time ──
  progress('Loading change log entries from DR database…', 15)

  const tablesToRestore: string[] = tables ?? (baseSnapshot.tables_included ?? [])

  const { data: changeEntries, error: clErr } = await drDb
    .from('dr_change_log')
    .select('*')
    .gt('changed_at', baseSnapshot.snapshot_timestamp)
    .lte('changed_at', targetTimestamp)
    .in('table_name', tablesToRestore)
    .order('changed_at', { ascending: true })
    .order('source_id',  { ascending: true })

  if (clErr) {
    errors.push(`Failed to load change log: ${clErr.message}`)
  }

  const changes = changeEntries ?? []
  progress(`Found ${changes.length} change log entries to replay`, 20)

  // ── Step 3: Download and restore the base snapshot ──
  progress('Downloading base snapshot from storage…', 25)

  const storageBucket = process.env.DR_STORAGE_BUCKET ?? 'dr-backups'
  const { data: fileData, error: dlErr } = await drDb.storage
    .from(storageBucket)
    .download(`${baseSnapshot.id}/_snapshot.json`)

  if (dlErr || !fileData) {
    return {
      success: false,
      baseSnapshotId: baseSnapshot.id,
      baseSnapshotTime: baseSnapshot.snapshot_timestamp,
      targetTime: targetTimestamp,
      tablesRestored: 0,
      recordsRestored: 0,
      changesReplayed: 0,
      nearestChangeAt: null,
      errors: [`Failed to download snapshot: ${dlErr?.message ?? 'File not found'}`],
    }
  }

  const snapshotText = await fileData.text()
  const snapshotPayload = JSON.parse(snapshotText)

  progress('Restoring base snapshot data…', 35)

  let totalRecordsRestored = 0
  let tablesRestored = 0

  // Restore each table from the base snapshot
  for (const tableName of tablesToRestore) {
    const rows: any[] = snapshotPayload.data?.[tableName] ?? []
    try {
      // Delete existing rows
      await srcDb.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000')

      // Insert snapshot rows in batches
      if (rows.length > 0) {
        const BATCH = 500
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH)
          const { error: insErr } = await srcDb.from(tableName).insert(batch)
          if (insErr) errors.push(`Snapshot restore ${tableName}: ${insErr.message}`)
        }
      }

      totalRecordsRestored += rows.length
      tablesRestored++
    } catch (err: any) {
      errors.push(`Snapshot restore ${tableName}: ${err.message}`)
    }
  }

  progress(`Base snapshot restored (${totalRecordsRestored.toLocaleString()} records across ${tablesRestored} tables)`, 60)

  // ── Step 4: Replay change log entries ──
  if (changes.length === 0) {
    progress('No change log entries to replay — base snapshot is the recovery point', 90)
  } else {
    progress(`Replaying ${changes.length} change log entries…`, 65)

    let replayed = 0
    let nearestChangeAt: string | null = null

    for (const entry of changes) {
      try {
        if (entry.operation === 'INSERT') {
          await srcDb.from(entry.table_name).upsert(entry.new_data, { ignoreDuplicates: false })
        } else if (entry.operation === 'UPDATE') {
          if (entry.row_id) {
            await srcDb.from(entry.table_name).update(entry.new_data).eq('id', entry.row_id)
          }
        } else if (entry.operation === 'DELETE') {
          if (entry.row_id) {
            await srcDb.from(entry.table_name).delete().eq('id', entry.row_id)
          }
        }
        replayed++
        nearestChangeAt = entry.changed_at
      } catch (err: any) {
        errors.push(`Replay [${entry.operation} ${entry.table_name} id=${entry.row_id}]: ${err.message}`)
      }

      // Report progress every 100 entries
      if (replayed % 100 === 0) {
        const pct = 65 + Math.floor((replayed / changes.length) * 25)
        progress(`Replaying changes… ${replayed}/${changes.length}`, pct)
      }
    }

    progress(`Replayed ${replayed} changes`, 90)
  }

  progress('PITR restore complete', 100)

  const nearestChangeAt = changes.length > 0
    ? changes[changes.length - 1].changed_at
    : null

  return {
    success: errors.length === 0,
    baseSnapshotId:   baseSnapshot.id,
    baseSnapshotTime: baseSnapshot.snapshot_timestamp,
    targetTime:       targetTimestamp,
    tablesRestored,
    recordsRestored:  totalRecordsRestored,
    changesReplayed:  changes.length,
    nearestChangeAt,
    errors,
  }
}
