import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSnapshotName } from '@/lib/utils'
import { z } from 'zod'

const CreateSnapshotSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  tables: z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20')
    const status = searchParams.get('status')

    let query = supabase
      .from('dr_snapshots')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (status) query = query.eq('status', status)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ snapshots: data, total: count, page, pageSize })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const parsed = CreateSnapshotSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { name, description, tables } = parsed.data

    // Create a snapshot job in the queue — the backup agent will pick it up
    const { data: job, error: jobError } = await supabase
      .from('dr_backup_jobs')
      .insert({
        job_type: 'full_backup',
        status: 'queued',
        priority: 200,
        metadata: {
          name: name ?? generateSnapshotName(),
          description,
          tables,
        },
      })
      .select()
      .single()

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 })
    }

    return NextResponse.json({ job, message: 'Backup job queued. An agent will process it shortly.' }, { status: 202 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
