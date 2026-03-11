import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const HeartbeatSchema = z.object({
  agent_name: z.string(),
  status: z.enum(['online', 'offline', 'degraded', 'error', 'starting']),
  current_jobs: z.number().default(0),
  pid: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    const parsed = HeartbeatSchema.safeParse(body)

    if (!parsed.success) return NextResponse.json({ error: 'Invalid heartbeat' }, { status: 400 })

    const { error } = await supabase
      .from('dr_agent_registry')
      .update({
        status: parsed.data.status,
        last_heartbeat: new Date().toISOString(),
        current_jobs: parsed.data.current_jobs,
        pid: parsed.data.pid,
        metadata: parsed.data.metadata ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
