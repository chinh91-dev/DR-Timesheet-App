#!/usr/bin/env tsx
/**
 * Backup Agent — polls the job queue and executes backup jobs
 * Run with: npm run agent:backup
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { claimJob, updateJobProgress, completeJob, failJob, requeueRetryJobs } from '@/lib/agents/job-queue'
import { registerAgent, sendHeartbeat, markAgentOffline } from '@/lib/agents/orchestrator'
import { createSnapshot } from '@/lib/backup/snapshot-manager'
import { env } from '@/env'
import { sleep } from '@/lib/utils'

const AGENT_NAME = `backup-agent-${process.pid}`
const AGENT_TYPE = 'backup_agent' as const

async function main() {
  const client = createAdminClient()
  console.log(`[${AGENT_NAME}] Starting...`)

  // Register agent
  const agent = await registerAgent(client, AGENT_NAME, AGENT_TYPE, env.MAX_CONCURRENT_JOBS)
  console.log(`[${AGENT_NAME}] Registered with ID: ${agent.id}`)

  // Send initial heartbeat
  await sendHeartbeat(client, AGENT_NAME, { status: 'online', current_jobs: 0 })

  // Heartbeat interval
  const heartbeatTimer = setInterval(async () => {
    await sendHeartbeat(client, AGENT_NAME, { status: 'online', current_jobs: 0 })
  }, env.AGENT_HEARTBEAT_INTERVAL_MS)

  // Graceful shutdown
  const shutdown = async () => {
    console.log(`[${AGENT_NAME}] Shutting down...`)
    clearInterval(heartbeatTimer)
    await markAgentOffline(client, AGENT_NAME)
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  // Main polling loop
  console.log(`[${AGENT_NAME}] Polling for jobs every ${env.AGENT_POLL_INTERVAL_MS}ms`)
  while (true) {
    try {
      // Requeue any jobs ready for retry
      const requeued = await requeueRetryJobs(client)
      if (requeued > 0) {
        console.log(`[${AGENT_NAME}] Requeued ${requeued} retry jobs`)
      }

      // Claim a backup job
      const job = await claimJob(client, agent.id, AGENT_NAME, ['full_backup', 'incremental_backup'])

      if (job) {
        console.log(`[${AGENT_NAME}] Claimed job ${job.id} (${job.job_type})`)

        try {
          const metadata = job.metadata as { tables?: string[]; name?: string; description?: string }

          await createSnapshot(
            client,
            {
              name: metadata.name,
              description: metadata.description,
              snapshot_type: job.job_type === 'full_backup' ? 'full' : 'incremental',
              tables: metadata.tables,
            },
            job.id,
            async (progress) => {
              await updateJobProgress(client, job.id, {
                progress_percent: progress.progress_percent,
                current_step: `Extracting ${progress.current_table ?? 'tables'}`,
                tables_processed: progress.tables_done,
                records_processed: progress.records_done,
              })
            }
          )

          await completeJob(client, job.id, { completed_at: new Date().toISOString() })
          console.log(`[${AGENT_NAME}] Job ${job.id} completed`)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          console.error(`[${AGENT_NAME}] Job ${job.id} failed:`, message)
          await failJob(client, job.id, message, 'BACKUP_FAILED')
        }
      }
    } catch (err) {
      console.error(`[${AGENT_NAME}] Poll error:`, err)
    }

    await sleep(env.AGENT_POLL_INTERVAL_MS)
  }
}

main().catch(console.error)
