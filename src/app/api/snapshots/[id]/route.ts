import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('dr_snapshots')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    return NextResponse.json({ snapshot: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check if snapshot exists and is not in use
    const { data: snapshot } = await supabase.from('dr_snapshots').select('status').eq('id', id).single()
    if (!snapshot) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    if (snapshot.status === 'in_progress') {
      return NextResponse.json({ error: 'Cannot delete a snapshot in progress' }, { status: 409 })
    }

    // Delete from database (storage cleanup done by agent)
    const { error } = await supabase.from('dr_snapshots').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Queue a cleanup job
    await supabase.from('dr_backup_jobs').insert({
      job_type: 'cleanup',
      status: 'queued',
      metadata: { snapshot_id: id },
    })

    return NextResponse.json({ message: 'Snapshot deleted' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
