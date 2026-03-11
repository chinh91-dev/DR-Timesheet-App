import { SupabaseClient } from '@supabase/supabase-js'
import type { Agent, AgentType, AgentHeartbeat } from '@/lib/types/agent'

export async function registerAgent(
  client: SupabaseClient,
  agentName: string,
  agentType: AgentType,
  maxConcurrentJobs = 3
): Promise<Agent> {
  const { data, error } = await client
    .from('dr_agent_registry')
    .upsert({
      agent_name: agentName,
      agent_type: agentType,
      status: 'starting',
      max_concurrent_jobs: maxConcurrentJobs,
      agent_version: '1.0.0',
      host: process.env.HOSTNAME ?? 'localhost',
      pid: process.pid,
      last_heartbeat: new Date().toISOString(),
    }, { onConflict: 'agent_name' })
    .select()
    .single()

  if (error) throw new Error(`Failed to register agent: ${error.message}`)
  return data as Agent
}

export async function sendHeartbeat(
  client: SupabaseClient,
  agentName: string,
  heartbeat: Partial<AgentHeartbeat>
): Promise<void> {
  await client
    .from('dr_agent_registry')
    .update({
      status: heartbeat.status ?? 'online',
      last_heartbeat: new Date().toISOString(),
      current_jobs: heartbeat.current_jobs ?? 0,
      pid: heartbeat.pid ?? process.pid,
      metadata: heartbeat.metadata ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq('agent_name', agentName)
}

export async function markAgentOffline(
  client: SupabaseClient,
  agentName: string
): Promise<void> {
  await client
    .from('dr_agent_registry')
    .update({
      status: 'offline',
      current_jobs: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('agent_name', agentName)
}

export async function getActiveAgents(client: SupabaseClient): Promise<Agent[]> {
  const { data, error } = await client
    .from('dr_agents_health')
    .select('*')
    .order('agent_type')

  if (error) return []
  return (data ?? []) as Agent[]
}

export async function getQueueDepth(
  client: SupabaseClient
): Promise<Record<string, number>> {
  const { data } = await client
    .from('dr_backup_jobs')
    .select('job_type, status')
    .in('status', ['queued', 'in_progress'])

  const depths: Record<string, number> = {}
  for (const row of data ?? []) {
    const key = `${row.job_type}_${row.status}`
    depths[key] = (depths[key] ?? 0) + 1
  }
  return depths
}
