import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Check database connectivity
    const { error: dbError } = await supabase
      .from('dr_snapshots')
      .select('id')
      .limit(1)

    // Check agent health
    const { data: agents } = await supabase
      .from('dr_agents_health')
      .select('agent_name, computed_status')

    const { data: queueDepth } = await supabase
      .from('dr_backup_jobs')
      .select('status')
      .in('status', ['queued', 'in_progress'])

    const onlineAgents = agents?.filter(a => a.computed_status === 'online').length ?? 0

    return NextResponse.json({
      status: dbError ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      database: dbError ? 'error' : 'connected',
      agents: {
        online: onlineAgents,
        total: agents?.length ?? 0,
      },
      queue: {
        queued: queueDepth?.filter(j => j.status === 'queued').length ?? 0,
        in_progress: queueDepth?.filter(j => j.status === 'in_progress').length ?? 0,
      },
    })
  } catch {
    return NextResponse.json({ status: 'error', timestamp: new Date().toISOString() }, { status: 500 })
  }
}
