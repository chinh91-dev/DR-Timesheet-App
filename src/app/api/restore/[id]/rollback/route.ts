import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get the restore log
    const { data: restoreLog } = await supabase
      .from('dr_restore_logs')
      .select('*')
      .eq('id', id)
      .single()

    if (!restoreLog) return NextResponse.json({ error: 'Restore log not found' }, { status: 404 })
    if (!restoreLog.safety_snapshot_id) {
      return NextResponse.json({ error: 'No safety snapshot available for rollback' }, { status: 400 })
    }
    if (restoreLog.status === 'rolled_back') {
      return NextResponse.json({ error: 'Already rolled back' }, { status: 409 })
    }

    // Queue rollback job
    const { data: job, error: jobError } = await supabase
      .from('dr_backup_jobs')
      .insert({
        job_type: 'rollback',
        status: 'queued',
        priority: 1000, // Highest priority
        metadata: { restore_log_id: id },
      })
      .select()
      .single()

    if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })

    return NextResponse.json({
      job,
      message: 'Rollback job queued with highest priority.',
    }, { status: 202 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
