#!/usr/bin/env tsx
/**
 * Verification Agent — validates snapshot integrity after backups
 * Run with: npm run agent:verify
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { claimJob, updateJobProgress, completeJob, failJob } from '@/lib/agents/job-queue'
import { registerAgent, sendHeartbeat, markAgentOffline } from '@/lib/agents/orchestrator'
import { downloadSnapshotMetadata } from '@/lib/backup/storage-handler'
import { getSnapshot } from '@/lib/backup/snapshot-manager'
import { env } from '@/env'
import { sleep } from '@/lib/utils'

const AGENT_NAME = `verify-agent-${process.pid}`
const AGENT_TYPE = 'verify_agent' as const

async function main() {
  const client = createAdminClient()
  const agent = await registerAgent(client, AGENT_NAME, AGENT_TYPE, 3)
  await sendHeartbeat(client, AGENT_NAME, { status: 'online', current_jobs: 0 })

  const heartbeatTimer = setInterval(async () => {
    await sendHeartbeat(client, AGENT_NAME, { status: 'online', current_jobs: 0 })
  }, env.AGENT_HEARTBEAT_INTERVAL_MS)

  process.on('SIGTERM', async () => { clearInterval(heartbeatTimer); await markAgentOffline(client, AGENT_NAME); process.exit(0) })
  process.on('SIGINT', async () => { clearInterval(heartbeatTimer); await markAgentOffline(client, AGENT_NAME); process.exit(0) })

  console.log(`[${AGENT_NAME}] Ready`)
  while (true) {
    try {
      const job = await claimJob(client, agent.id, AGENT_NAME, 'verify_backup')

      if (job) {
        const metadata = job.metadata as { snapshot_id?: string }
        if (!metadata.snapshot_id) {
          await failJob(client, job.id, 'No snapshot_id in job metadata')
          continue
        }

        try {
          await updateJobProgress(client, job.id, { current_step: 'Loading snapshot metadata...', progress_percent: 10 })

          const snapshot = await getSnapshot(client, metadata.snapshot_id)
          if (!snapshot || snapshot.status !== 'completed') {
            throw new Error('Snapshot not found or not completed')
          }

          await updateJobProgress(client, job.id, { current_step: 'Verifying storage files...', progress_percent: 30 })

          // Download and verify metadata
          const snapshotMetadata = await downloadSnapshotMetadata(client, metadata.snapshot_id)

          // Verify record counts match
          const tables = snapshotMetadata.tables
          let issues: string[] = []

          for (let i = 0; i < tables.length; i++) {
            const table = tables[i]
            const expectedCount = snapshotMetadata.record_counts[table] ?? 0
            const snapshotCount = snapshot.record_counts?.[table] ?? 0

            if (expectedCount !== snapshotCount) {
              issues.push(`${table}: metadata says ${expectedCount} rows but snapshot says ${snapshotCount}`)
            }

            await updateJobProgress(client, job.id, {
              current_step: `Verifying ${table}...`,
              progress_percent: Math.round(30 + (i / tables.length) * 60),
              tables_processed: i + 1,
            })
          }

          if (issues.length > 0) {
            await failJob(client, job.id, `Verification issues: ${issues.join('; ')}`, 'VERIFY_FAILED')
          } else {
            await completeJob(client, job.id, { verified_tables: tables, issues: [] })
            console.log(`[${AGENT_NAME}] Snapshot ${metadata.snapshot_id} verified OK`)
          }
        } catch (err) {
          await failJob(client, job.id, err instanceof Error ? err.message : 'Unknown error', 'VERIFY_ERROR')
        }
      }
    } catch (err) {
      console.error(`[${AGENT_NAME}] Poll error:`, err)
    }

    await sleep(env.AGENT_POLL_INTERVAL_MS)
  }
}

main().catch(console.error)
