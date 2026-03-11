import { SupabaseClient } from '@supabase/supabase-js'
import type { SnapshotTableData, SnapshotMetadata } from '@/lib/types/snapshot'

const BUCKET_NAME = 'dr-backups'

export async function ensureBucketExists(client: SupabaseClient): Promise<void> {
  const { data: buckets } = await client.storage.listBuckets()
  const exists = buckets?.some(b => b.name === BUCKET_NAME)

  if (!exists) {
    const { error } = await client.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 524288000, // 500MB
    })
    if (error && !error.message.includes('already exists')) {
      throw new Error(`Failed to create storage bucket: ${error.message}`)
    }
  }
}

export async function uploadTableSnapshot(
  client: SupabaseClient,
  snapshotId: string,
  tableData: SnapshotTableData
): Promise<string> {
  const path = `${snapshotId}/${tableData.table_name}.json`
  const content = JSON.stringify(tableData, null, 0)
  const blob = new Blob([content], { type: 'application/json' })

  const { error } = await client.storage
    .from(BUCKET_NAME)
    .upload(path, blob, { upsert: true })

  if (error) throw new Error(`Failed to upload ${tableData.table_name}: ${error.message}`)
  return path
}

export async function uploadSnapshotMetadata(
  client: SupabaseClient,
  snapshotId: string,
  metadata: SnapshotMetadata
): Promise<string> {
  const path = `${snapshotId}/_metadata.json`
  const content = JSON.stringify(metadata, null, 2)
  const blob = new Blob([content], { type: 'application/json' })

  const { error } = await client.storage
    .from(BUCKET_NAME)
    .upload(path, blob, { upsert: true })

  if (error) throw new Error(`Failed to upload metadata: ${error.message}`)
  return path
}

export async function downloadTableSnapshot(
  client: SupabaseClient,
  storagePath: string
): Promise<SnapshotTableData> {
  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .download(storagePath)

  if (error) throw new Error(`Failed to download ${storagePath}: ${error.message}`)
  if (!data) throw new Error(`No data at ${storagePath}`)

  const text = await data.text()
  return JSON.parse(text) as SnapshotTableData
}

export async function downloadSnapshotMetadata(
  client: SupabaseClient,
  snapshotId: string
): Promise<SnapshotMetadata> {
  const path = `${snapshotId}/_metadata.json`
  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .download(path)

  if (error) throw new Error(`Failed to download metadata: ${error.message}`)
  if (!data) throw new Error(`No metadata at ${path}`)

  const text = await data.text()
  return JSON.parse(text) as SnapshotMetadata
}

export async function listSnapshotFiles(
  client: SupabaseClient,
  snapshotId: string
): Promise<string[]> {
  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .list(snapshotId)

  if (error) throw new Error(`Failed to list snapshot files: ${error.message}`)
  return (data ?? []).map(f => `${snapshotId}/${f.name}`)
}

export async function deleteSnapshot(
  client: SupabaseClient,
  snapshotId: string
): Promise<void> {
  const files = await listSnapshotFiles(client, snapshotId)
  if (files.length > 0) {
    const { error } = await client.storage.from(BUCKET_NAME).remove(files)
    if (error) throw new Error(`Failed to delete snapshot files: ${error.message}`)
  }
}

export async function getSnapshotStorageSize(
  client: SupabaseClient,
  snapshotId: string
): Promise<number> {
  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .list(snapshotId)

  if (error) return 0
  return (data ?? []).reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0)
}
