#!/usr/bin/env tsx
/**
 * Restore Agent — polls the job queue and executes restore/rollback jobs
 * Run with: npm run agent:restore
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { claimJob, updateJobProgress, completeJob, failJob } from '@/lib/agents/job-queue'
import { registerAgent, sendHeartbeat, markAgentOffline } from '@/lib/agents/orchestrator'
import { restoreSnapshot } from '@/lib/restore/restore-executor'
import { createSafetySnapshot, rollbackRestore } from '@/lib/restore/rollback-handler'
import { getSnapshot } from '@/lib/backup/snapshot-manager'
import { env } from '@/env'
import { sleep } from '@/lib/utils'

const AGENT_NAME = `restore-agent-${process.pid}`
const AGENT_TYPE = 'restore_agent' as const

async function main() {
  const client = createAdminClient()
  console.log(`[${AGENT_NAME}] Starting...`)

  const agent = await registerAgent(client, AGENT_NAME, AGENT_TYPE, 1) // Only 1 restore at a time!
  await sendHeartbeat(client, AGENT_NAME, { status: 'online', current_jobs: 0 })

  const heartbeatTimer = setInterval(async () => {
    await sendHeartbeat(client, AGENT_NAME, { status: 'online', current_jobs: 0 })
  }, env.AGENT_HEARTBEAT_INTERVAL_MS)

  const shutdown = async () => {
    clearInterval(heartbeatTimer)
    await markAgentOffline(client, AGENT_NAME)
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  console.log(`[${AGENT_NAME}] Ready to process restore/rollback jobs`)
  while (true) {
    try {
      const job = await claimJob(client, agent.id, AGENT_NAME, ['restore', 'rollback'])

      if (job) {
        console.log(`[${AGENT_NAME}] Claimed ${job.job_type} job ${job.id}`)

        try {
          const metadata = job.metadata as {
            snapshot_id?: string
            restore_log_id?: string
            tables?: string[]
          }

          if (job.job_type === 'rollback' && metadata.restore_log_id) {
            await rollbackRestore(client, metadata.restore_log_id)
            await completeJob(client, job.id)
          } else if (job.job_type === 'restore' && metadata.snapshot_id) {
            // Create safety snapshot first
            if (metadata.restore_log_id) {
              await updateJobProgress(client, job.id, { current_step: 'Creating safety snapshot...' })
              await createSafetySnapshot(client, metadata.restore_log_id)
            }

            const snapshot = await getSnapshot(client, metadata.snapshot_id)
            if (!snapshot) throw new Error(`Snapshot ${metadata.snapshot_id} not found`)

            const tables = metadata.tables ?? (snapshot.tables_included as string[]) ?? env.BACKUP_TABLES

            await restoreSnapshot(client, metadata.snapshot_id, tables, async (progress) => {
              await updateJobProgress(client, job.id, {
                progress_percent: progress.progress_percent,
                current_step: `${progress.phase}: ${progress.current_table ?? ''}`,
                tables_processed: progress.tables_done,
                records_processed: progress.records_inserted,
              })
            })

            await completeJob(client, job.id)
          }

          console.log(`[${AGENT_NAME}] Job ${job.id} completed`)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          console.error(`[${AGENT_NAME}] Job ${job.id} failed:`, message)
          await failJob(client, job.id, message, 'RESTORE_FAILED')
        }
      }
    } catch (err) {
      console.error(`[${AGENT_NAME}] Poll error:`, err)
    }

    await sleep(env.AGENT_POLL_INTERVAL_MS)
  }
}

main().catch(console.error)
