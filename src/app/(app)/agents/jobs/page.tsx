import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ProgressBar } from '@/components/common/ProgressBar'
import { formatRelativeTime, formatDuration } from '@/lib/utils'
import { ScrollText } from 'lucide-react'
import { LiveJobMonitor } from '@/components/jobs/LiveJobMonitor'
import { TriggerBackupButton } from '@/components/jobs/TriggerBackupButton'

export default async function JobQueuePage() {
  const supabase = await createClient()
  const { data: jobs } = await supabase
    .from('dr_backup_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  const active = jobs?.filter((j: any) => ['queued', 'in_progress', 'retrying'].includes(j.status)) ?? []
  const completed = jobs?.filter((j: any) => !['queued', 'in_progress', 'retrying'].includes(j.status)) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Job Queue</h2>
          <p className="text-sm text-gray-500 mt-1">Monitor all backup, restore, and verification jobs</p>
        </div>
        <TriggerBackupButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {['queued', 'in_progress', 'completed', 'failed'].map(status => {
          const count = jobs?.filter((j: any) => j.status === status).length ?? 0
          return (
            <div key={status} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <StatusBadge status={status} className="mt-1" />
            </div>
          )
        })}
      </div>

      <LiveJobMonitor />

      {/* Active Jobs */}
      {active.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Active Jobs</h3>
          <div className="space-y-4">
            {active.map((job: any) => (
              <div key={job.id} className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{job.job_type.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-gray-500 font-mono">{job.id.slice(0, 8)}...</div>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                {job.current_step && (
                  <div className="text-xs text-gray-600 mb-2">{job.current_step}</div>
                )}
                <ProgressBar value={job.progress_percent ?? 0} />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Agent: {job.agent_name ?? 'Waiting...'}</span>
                  <span>{formatRelativeTime(job.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Jobs History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Job History</h3>
        </div>
        {!jobs || jobs.length === 0 ? (
          <div className="text-center py-12">
            <ScrollText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No jobs yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Progress</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Agent</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job: any) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900 capitalize">{job.job_type.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-6 py-3 text-sm text-gray-600">{job.progress_percent ?? 0}%</td>
                  <td className="px-6 py-3 text-xs text-gray-500 font-mono">{job.agent_name ?? '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{job.duration_seconds ? formatDuration(job.duration_seconds) : '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{formatRelativeTime(job.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
