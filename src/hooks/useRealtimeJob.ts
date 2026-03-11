'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BackupJob, JobProgress } from '@/lib/types/job'

export function useRealtimeJob(jobId: string | null) {
  const [job, setJob] = useState<BackupJob | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchJob = useCallback(async () => {
    if (!jobId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('dr_backup_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    if (data) setJob(data as BackupJob)
  }, [jobId])

  useEffect(() => {
    if (!jobId) return
    setLoading(true)
    fetchJob().finally(() => setLoading(false))

    const supabase = createClient()
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'dr_backup_jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          setJob(payload.new as BackupJob)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [jobId, fetchJob])

  return { job, loading, refetch: fetchJob }
}
