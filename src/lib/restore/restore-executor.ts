import { SupabaseClient } from '@supabase/supabase-js'
import { downloadTableSnapshot } from '@/lib/backup/storage-handler'
import { validatePostRestore } from './data-validator'
import type { SnapshotTableData } from '@/lib/types/snapshot'

export interface RestoreProgress {
  phase: 'downloading' | 'truncating' | 'inserting' | 'validating'
  current_table?: string
  tables_done: number
  tables_total: number
  records_inserted: number
  progress_percent: number
}

const INSERT_BATCH_SIZE = 500

export async function restoreSnapshot(
  client: SupabaseClient,
  snapshotId: string,
  tables: string[],
  onProgress?: (progress: RestoreProgress) => Promise<void>
): Promise<{
  success: boolean
  tables_restored: string[]
  records_inserted: Record<string, number>
  validation: { passed: boolean; errors: string[]; summary: Record<string, unknown> }
}> {
  const tableDataList: SnapshotTableData[] = []
  const recordsInserted: Record<string, number> = {}

  // 1. Download all table snapshots
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]
    await onProgress?.({
      phase: 'downloading',
      current_table: table,
      tables_done: i,
      tables_total: tables.length,
      records_inserted: 0,
      progress_percent: Math.round((i / tables.length) * 20),
    })

    const tableData = await downloadTableSnapshot(client, `${snapshotId}/${table}.json`)
    tableDataList.push(tableData)
  }

  // 2. Truncate all tables in reverse order (to respect FK constraints)
  const reversedTables = [...tables].reverse()
  for (let i = 0; i < reversedTables.length; i++) {
    const table = reversedTables[i]
    await onProgress?.({
      phase: 'truncating',
      current_table: table,
      tables_done: i,
      tables_total: tables.length,
      records_inserted: 0,
      progress_percent: Math.round(20 + (i / tables.length) * 15),
    })

    const { error } = await client.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      // Try without the UUID filter
      const { error: deleteError } = await client.rpc('truncate_table', { table_name: table })
      if (deleteError) {
        console.warn(`Could not truncate ${table}: ${deleteError.message}`)
      }
    }
  }

  // 3. Insert data for each table
  let totalInserted = 0
  for (let i = 0; i < tableDataList.length; i++) {
    const td = tableDataList[i]

    await onProgress?.({
      phase: 'inserting',
      current_table: td.table_name,
      tables_done: i,
      tables_total: tables.length,
      records_inserted: totalInserted,
      progress_percent: Math.round(35 + (i / tables.length) * 50),
    })

    let tableInserted = 0
    // Insert in batches
    for (let offset = 0; offset < td.rows.length; offset += INSERT_BATCH_SIZE) {
      const batch = td.rows.slice(offset, offset + INSERT_BATCH_SIZE)
      const { error } = await client.from(td.table_name).insert(batch)
      if (error) throw new Error(`Failed to insert into ${td.table_name}: ${error.message}`)
      tableInserted += batch.length
      totalInserted += batch.length
    }

    recordsInserted[td.table_name] = tableInserted
  }

  // 4. Validate
  await onProgress?.({
    phase: 'validating',
    tables_done: tables.length,
    tables_total: tables.length,
    records_inserted: totalInserted,
    progress_percent: 90,
  })

  const validation = await validatePostRestore(client, tableDataList)

  await onProgress?.({
    phase: 'validating',
    tables_done: tables.length,
    tables_total: tables.length,
    records_inserted: totalInserted,
    progress_percent: 100,
  })

  return {
    success: validation.passed,
    tables_restored: tables,
    records_inserted: recordsInserted,
    validation,
  }
}
