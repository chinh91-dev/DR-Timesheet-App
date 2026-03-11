import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatRelativeTime } from '@/lib/utils'
import { Bot, Activity, Terminal } from 'lucide-react'

export default async function AgentsPage() {
  const supabase = await createClient()
  const { data: agents } = await supabase
    .from('dr_agents_health')
    .select('*')
    .order('agent_type')

  const online = agents?.filter((a: any) => a.computed_status === 'online').length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Agent Registry</h2>
          <p className="text-sm text-gray-500 mt-1">Monitor and manage all DR worker agents</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-green-700 font-medium">{online} Online</span>
        </div>
      </div>

      {/* Start command hint */}
      <div className="flex items-start gap-3 p-4 bg-gray-900 rounded-xl">
        <Terminal className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-sm font-medium text-gray-300">Start all agents</div>
          <code className="text-sm text-green-400 font-mono">npm run agents</code>
          <div className="text-xs text-gray-500 mt-1">Or start individually: <code className="text-green-400">npm run agent:backup</code></div>
        </div>
      </div>

      {/* Agent Cards */}
      {!agents || agents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No agents registered yet</p>
          <p className="text-sm text-gray-400 mt-1">Start agents with <code className="bg-gray-100 px-1 rounded">npm run agents</code></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent: any) => (
            <div key={agent.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Bot className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{agent.agent_name}</div>
                    <div className="text-xs text-gray-500 capitalize">{agent.agent_type.replace(/_/g, ' ')}</div>
                  </div>
                </div>
                <StatusBadge status={agent.computed_status ?? agent.status} />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Jobs (current/max)</span>
                  <span className="font-mono text-gray-700">{agent.current_jobs} / {agent.max_concurrent_jobs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Completed</span>
                  <span className="font-mono text-gray-700">{agent.jobs_completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Failed</span>
                  <span className={`font-mono ${agent.jobs_failed > 0 ? 'text-red-600' : 'text-gray-700'}`}>{agent.jobs_failed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last heartbeat</span>
                  <span className="text-gray-700">
                    {agent.last_heartbeat ? formatRelativeTime(agent.last_heartbeat) : 'Never'}
                    {agent.seconds_since_heartbeat != null && ` (${agent.seconds_since_heartbeat}s ago)`}
                  </span>
                </div>
                {agent.last_error && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600 font-mono truncate">
                    {agent.last_error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
