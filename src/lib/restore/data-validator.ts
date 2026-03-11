import { SupabaseClient } from '@supabase/supabase-js'
import type { RestoreValidation } from '@/lib/types/restore'
import type { SnapshotTableData } from '@/lib/types/snapshot'

export async function validateRestoreTarget(
  client: SupabaseClient,
  snapshotId: string,
  tableData: SnapshotTableData[]
): Promise<RestoreValidation> {
  const warnings: string[] = []
  const errors: string[] = []
  const tablesAvailable: string[] = []
  const estimatedRecords: Record<string, number> = {}

  // Check each table is accessible
  for (const td of tableData) {
    const { error } = await client
      .from(td.table_name)
      .select('*', { count: 'exact', head: true })

    if (error) {
      errors.push(`Table '${td.table_name}' is not accessible: ${error.message}`)
    } else {
      tablesAvailable.push(td.table_name)
      estimatedRecords[td.table_name] = td.total_rows

      // Warn about large tables
      if (td.total_rows > 10000) {
        warnings.push(`Table '${td.table_name}' has ${td.total_rows} rows — restore may take a while`)
      }
    }
  }

  // Check for empty snapshot
  if (tableData.length === 0) {
    errors.push('Snapshot contains no table data')
  }

  return {
    is_valid: errors.length === 0,
    snapshot_exists: true,
    storage_accessible: true,
    tables_available: tablesAvailable,
    estimated_records: estimatedRecords,
    warnings,
    errors,
  }
}

export async function validatePostRestore(
  client: SupabaseClient,
  tableData: SnapshotTableData[]
): Promise<{ passed: boolean; errors: string[]; summary: Record<string, unknown> }> {
  const errors: string[] = []
  const summary: Record<string, { expected: number; actual: number; match: boolean }> = {}

  for (const td of tableData) {
    const { count, error } = await client
      .from(td.table_name)
      .select('*', { count: 'exact', head: true })

    if (error) {
      errors.push(`Could not verify ${td.table_name}: ${error.message}`)
      summary[td.table_name] = { expected: td.total_rows, actual: -1, match: false }
      continue
    }

    const actual = count ?? 0
    const match = actual === td.total_rows
    summary[td.table_name] = { expected: td.total_rows, actual, match }

    if (!match) {
      errors.push(`Row count mismatch in ${td.table_name}: expected ${td.total_rows}, got ${actual}`)
    }
  }

  return { passed: errors.length === 0, errors, summary }
}
