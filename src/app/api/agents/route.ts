import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('dr_agents_health')
      .select('*')
      .order('agent_type')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ agents: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
