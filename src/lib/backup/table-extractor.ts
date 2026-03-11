import { SupabaseClient } from '@supabase/supabase-js'
import type { SnapshotTableData, ColumnDefinition } from '@/lib/types/snapshot'

const BATCH_SIZE = 1000

export async function extractTable(
  client: SupabaseClient,
  tableName: string,
  batchSize = BATCH_SIZE,
  onProgress?: (processed: number, total: number) => void
): Promise<SnapshotTableData> {
  // Get total count
  const { count, error: countError } = await client
    .from(tableName)
    .select('*', { count: 'exact', head: true })

  if (countError) throw new Error(`Failed to count rows in ${tableName}: ${countError.message}`)

  const total = count ?? 0
  const rows: Record<string, unknown>[] = []

  // Read in batches
  let offset = 0
  while (offset < total) {
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .range(offset, offset + batchSize - 1)

    if (error) throw new Error(`Failed to read ${tableName} at offset ${offset}: ${error.message}`)

    rows.push(...(data ?? []))
    offset += batchSize
    onProgress?.(Math.min(offset, total), total)
  }

  // Infer columns from first row
  const columns = inferColumns(rows[0] ?? {})

  return {
    table_name: tableName,
    schema_version: 1,
    snapshot_timestamp: new Date().toISOString(),
    total_rows: rows.length,
    columns,
    rows,
  }
}

export async function getTableRowCount(
  client: SupabaseClient,
  tableName: string
): Promise<number> {
  const { count, error } = await client
    .from(tableName)
    .select('*', { count: 'exact', head: true })

  if (error) return 0
  return count ?? 0
}

export async function getAllTableCounts(
  client: SupabaseClient,
  tables: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  await Promise.all(
    tables.map(async (table) => {
      counts[table] = await getTableRowCount(client, table)
    })
  )
  return counts
}

function inferColumns(row: Record<string, unknown>): ColumnDefinition[] {
  return Object.entries(row).map(([name, value]) => ({
    name,
    type: inferType(value),
    nullable: value === null,
  }))
}

function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'text'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'numeric'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'object') return 'jsonb'
  if (typeof value === 'string') {
    // Detect UUIDs
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'uuid'
    // Detect timestamps
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'timestamptz'
    return 'text'
  }
  return 'text'
}
