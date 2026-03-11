'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ProgressBar } from '@/components/common/ProgressBar'
import { formatRelativeTime } from '@/lib/utils'
import { Loader2, RefreshCw } from 'lucide-react'

interface Job {
  id: string
  job_type: string
  status: string
  progress_percent: number
  current_step?: string
  agent_name?: string
  tables_processed: number
  tables_total: number
  error_message?: string
  created_at: string
  updated_at: string
}

export function LiveJobMonitor() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchJobs = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('dr_backup_jobs')
      .select('*')
      .in('status', ['queued', 'in_progress', 'retrying'])
      .order('created_at', { ascending: false })
    setJobs((data ?? []) as Job[])
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchJobs()
    const supabase = createClient()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('active-jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dr_backup_jobs' },
        () => fetchJobs()
      )
      .subscribe()

    // Also poll every 10s as fallback
    const interval = setInterval(fetchJobs, 10000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchJobs])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-3 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading active jobs...</span>
      </div>
    )
  }

  if (jobs.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-blue-800">
            {jobs.length} Active Job{jobs.length !== 1 ? 's' : ''} — Live
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-blue-600">
          <RefreshCw className="w-3 h-3" />
          Updated {formatRelativeTime(lastUpdated.toISOString())}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {jobs.map(job => (
          <div key={job.id} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-medium text-gray-900 text-sm capitalize">
                  {job.job_type.replace(/_/g, ' ')}
                </div>
                <div className="text-xs text-gray-400 font-mono mt-0.5">{job.id.slice(0, 12)}...</div>
              </div>
              <StatusBadge status={job.status} />
            </div>

            <ProgressBar
              value={job.progress_percent ?? 0}
              label={job.current_step ?? 'Processing...'}
              color={job.status === 'retrying' ? 'bg-orange-500' : 'bg-blue-600'}
            />

            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>
                Agent: <span className="font-mono">{job.agent_name ?? 'Waiting for agent...'}</span>
              </span>
              {job.tables_total > 0 && (
                <span>{job.tables_processed}/{job.tables_total} tables</span>
              )}
            </div>

            {job.error_message && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-mono">
                {job.error_message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
