import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { downloadSnapshotMetadata } from '@/lib/backup/storage-handler'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get snapshot
    const { data: snapshot, error } = await supabase
      .from('dr_snapshots')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !snapshot) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    if (snapshot.status !== 'completed') {
      return NextResponse.json({ error: 'Snapshot not yet completed' }, { status: 409 })
    }

    // Download metadata
    const metadata = await downloadSnapshotMetadata(supabase, id)

    return NextResponse.json({
      snapshot_id: id,
      snapshot_timestamp: snapshot.snapshot_timestamp,
      tables: metadata.tables,
      record_counts: metadata.record_counts,
      total_records: Object.values(metadata.record_counts).reduce((a: number, b) => a + (b as number), 0),
      storage_size_bytes: snapshot.storage_size_bytes,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
