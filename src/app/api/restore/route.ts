import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RestoreRequestSchema = z.object({
  snapshot_id: z.string().uuid(),
  restore_type: z.enum(['snapshot', 'point_in_time', 'rollback', 'safety_rollback']),
  approval_notes: z.string().optional(),
  tables: z.array(z.string()).optional(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('dr_restore_logs')
      .select('*, dr_snapshots(name, snapshot_timestamp)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ restores: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const parsed = RestoreRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { snapshot_id, restore_type, approval_notes, tables } = parsed.data

    // Verify snapshot exists and is completed
    const { data: snapshot } = await supabase
      .from('dr_snapshots')
      .select('*')
      .eq('id', snapshot_id)
      .eq('status', 'completed')
      .single()

    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot not found or not completed' }, { status: 404 })
    }

    // Create restore log
    const { data: restoreLog, error: logError } = await supabase
      .from('dr_restore_logs')
      .insert({
        snapshot_id,
        restore_type,
        status: 'pending',
        tables_total: tables?.length ?? (snapshot.tables_included as string[])?.length ?? 0,
        approval_notes,
        confirmed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

    // Queue restore job
    const { data: job, error: jobError } = await supabase
      .from('dr_backup_jobs')
      .insert({
        job_type: 'restore',
        status: 'queued',
        priority: 500, // High priority
        metadata: {
          snapshot_id,
          restore_log_id: restoreLog.id,
          tables,
        },
      })
      .select()
      .single()

    if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })

    return NextResponse.json({
      restore_log: restoreLog,
      job,
      message: 'Restore job queued. Monitor progress in real-time.',
    }, { status: 202 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
