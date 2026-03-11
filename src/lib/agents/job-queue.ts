import { SupabaseClient } from '@supabase/supabase-js'
import type { BackupJob, JobStatus, JobType } from '@/lib/types/job'

export async function claimJob(
  client: SupabaseClient,
  agentId: string,
  agentName: string,
  jobType: JobType | JobType[]
): Promise<BackupJob | null> {
  const types = Array.isArray(jobType) ? jobType : [jobType]

  // Atomic claim: find a queued job and claim it
  const { data: jobs, error } = await client
    .from('dr_backup_jobs')
    .select('*')
    .in('job_type', types)
    .eq('status', 'queued')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)

  if (error || !jobs || jobs.length === 0) return null

  const job = jobs[0] as BackupJob

  // Try to claim it (optimistic locking via status check)
  const { data: claimed, error: claimError } = await client
    .from('dr_backup_jobs')
    .update({
      status: 'in_progress',
      agent_id: agentId,
      agent_name: agentName,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('status', 'queued') // Only claim if still queued
    .select()
    .single()

  if (claimError || !claimed) return null // Someone else claimed it
  return claimed as BackupJob
}

export async function updateJobProgress(
  client: SupabaseClient,
  jobId: string,
  progress: {
    progress_percent?: number
    current_step?: string
    tables_processed?: number
    records_processed?: number
    current_step_number?: number
  }
): Promise<void> {
  await client
    .from('dr_backup_jobs')
    .update({ ...progress, updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

export async function completeJob(
  client: SupabaseClient,
  jobId: string,
  result?: Record<string, unknown>
): Promise<void> {
  const { data: job } = await client
    .from('dr_backup_jobs')
    .select('started_at')
    .eq('id', jobId)
    .single()

  const startedAt = job?.started_at ? new Date(job.started_at) : new Date()
  const durationSeconds = Math.round((Date.now() - startedAt.getTime()) / 1000)

  await client
    .from('dr_backup_jobs')
    .update({
      status: 'completed',
      progress_percent: 100,
      completed_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      result: result ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export async function failJob(
  client: SupabaseClient,
  jobId: string,
  error: string,
  errorCode?: string
): Promise<void> {
  const { data: job } = await client
    .from('dr_backup_jobs')
    .select('retry_count, max_retries, started_at')
    .eq('id', jobId)
    .single()

  if (!job) return

  const startedAt = job.started_at ? new Date(job.started_at) : new Date()
  const durationSeconds = Math.round((Date.now() - startedAt.getTime()) / 1000)
  const shouldRetry = job.retry_count < job.max_retries

  await client
    .from('dr_backup_jobs')
    .update({
      status: shouldRetry ? 'retrying' : 'failed',
      error_message: error,
      error_code: errorCode,
      completed_at: shouldRetry ? null : new Date().toISOString(),
      duration_seconds: durationSeconds,
      retry_count: job.retry_count + 1,
      next_retry_at: shouldRetry
        ? new Date(Date.now() + Math.pow(2, job.retry_count) * 30000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export async function requeueRetryJobs(client: SupabaseClient): Promise<number> {
  const { data, error } = await client
    .from('dr_backup_jobs')
    .update({ status: 'queued', updated_at: new Date().toISOString() })
    .eq('status', 'retrying')
    .lte('next_retry_at', new Date().toISOString())
    .select()

  if (error) return 0
  return data?.length ?? 0
}
