import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatBytes, formatRelativeTime } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Database, RotateCcw, Bot, HardDrive, Clock, CheckCircle2, XCircle } from 'lucide-react'

async function getDashboardData() {
  const supabase = await createClient()

  const [snapshotsRes, jobsRes, agentsRes, restoresRes] = await Promise.all([
    supabase.from('dr_snapshots').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('dr_backup_jobs').select('*').in('status', ['queued', 'in_progress']).order('created_at', { ascending: false }),
    supabase.from('dr_agents_health').select('*'),
    supabase.from('dr_restore_logs').select('*').order('created_at', { ascending: false }).limit(5),
  ])

  return {
    recentSnapshots: snapshotsRes.data ?? [],
    activeJobs: jobsRes.data ?? [],
    agents: agentsRes.data ?? [],
    recentRestores: restoresRes.data ?? [],
  }
}

export default async function DashboardPage() {
  const { recentSnapshots, activeJobs, agents, recentRestores } = await getDashboardData()

  const totalStorage = recentSnapshots.reduce((sum: number, s: any) => sum + (s.storage_size_bytes ?? 0), 0)
  const onlineAgents = agents.filter((a: any) => a.computed_status === 'online').length
  const lastBackup = recentSnapshots.find((s: any) => s.status === 'completed')

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Database className="w-5 h-5 text-blue-600" />}
          title="Total Snapshots"
          value={String(recentSnapshots.length)}
          sub="in database"
          bg="bg-blue-50"
        />
        <MetricCard
          icon={<HardDrive className="w-5 h-5 text-purple-600" />}
          title="Storage Used"
          value={formatBytes(totalStorage)}
          sub="across all snapshots"
          bg="bg-purple-50"
        />
        <MetricCard
          icon={<Bot className="w-5 h-5 text-green-600" />}
          title="Online Agents"
          value={`${onlineAgents} / ${agents.length}`}
          sub="workers active"
          bg="bg-green-50"
        />
        <MetricCard
          icon={<Clock className="w-5 h-5 text-orange-600" />}
          title="Last Backup"
          value={lastBackup ? formatRelativeTime(lastBackup.snapshot_timestamp) : 'Never'}
          sub={lastBackup?.name ?? '—'}
          bg="bg-orange-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Snapshots */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Snapshots</h2>
            <Link href="/snapshots" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recentSnapshots.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No snapshots yet. <Link href="/snapshots" className="text-blue-600 hover:underline">Create one</Link></p>
            ) : recentSnapshots.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{s.name}</div>
                  <div className="text-xs text-gray-500">{formatRelativeTime(s.created_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{formatBytes(s.storage_size_bytes ?? 0)}</span>
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Jobs + Agent Health */}
        <div className="space-y-4">
          {/* Active Jobs */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Active Jobs</h2>
              <Link href="/agents/jobs" className="text-sm text-blue-600 hover:underline">View queue</Link>
            </div>
            {activeJobs.length === 0 ? (
              <p className="text-sm text-gray-500">No active jobs</p>
            ) : activeJobs.map((j: any) => (
              <div key={j.id} className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-700">{j.job_type.replace(/_/g, ' ')}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500">{j.progress_percent}%</div>
                  <StatusBadge status={j.status} />
                </div>
              </div>
            ))}
          </div>

          {/* Agent Health */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Agent Health</h2>
            {agents.length === 0 ? (
              <p className="text-sm text-gray-500">No agents registered. Run <code className="bg-gray-100 px-1 rounded">npm run agents</code></p>
            ) : agents.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-700">{a.agent_name}</div>
                <StatusBadge status={a.computed_status ?? a.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/snapshots" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Database className="w-4 h-4" /> Create Snapshot
          </Link>
          <Link href="/restore" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            <RotateCcw className="w-4 h-4" /> Restore Database
          </Link>
          <Link href="/agents" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Bot className="w-4 h-4" /> View Agents
          </Link>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon, title, value, sub, bg }: {
  icon: React.ReactNode, title: string, value: string, sub: string, bg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm font-medium text-gray-700 mt-0.5">{title}</div>
      <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
    </div>
  )
}
