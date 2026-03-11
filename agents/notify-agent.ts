#!/usr/bin/env tsx
/**
 * Notification Agent — sends alerts on backup/restore completion or failure
 * Run with: npm run agent:notify
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { registerAgent, sendHeartbeat, markAgentOffline } from '@/lib/agents/orchestrator'
import { env } from '@/env'
import { sleep } from '@/lib/utils'

const AGENT_NAME = `notify-agent-${process.pid}`
const AGENT_TYPE = 'notify_agent' as const

let lastCheckedAt = new Date(Date.now() - 60000).toISOString()

async function main() {
  const client = createAdminClient()
  await registerAgent(client, AGENT_NAME, AGENT_TYPE, 1)
  await sendHeartbeat(client, AGENT_NAME, { status: 'online', current_jobs: 0 })

  const heartbeatTimer = setInterval(async () => {
    await sendHeartbeat(client, AGENT_NAME, { status: 'online', current_jobs: 0 })
  }, env.AGENT_HEARTBEAT_INTERVAL_MS)

  process.on('SIGTERM', async () => { clearInterval(heartbeatTimer); await markAgentOffline(client, AGENT_NAME); process.exit(0) })
  process.on('SIGINT', async () => { clearInterval(heartbeatTimer); await markAgentOffline(client, AGENT_NAME); process.exit(0) })

  console.log(`[${AGENT_NAME}] Watching for completed/failed jobs...`)
  while (true) {
    try {
      // Find newly completed or failed jobs since last check
      const { data: jobs } = await client
        .from('dr_backup_jobs')
        .select('*, dr_snapshots(*)')
        .in('status', ['completed', 'failed'])
        .gte('updated_at', lastCheckedAt)
        .order('updated_at', { ascending: true })

      if (jobs && jobs.length > 0) {
        const { data: config } = await client
          .from('dr_backup_config')
          .select('*')
          .eq('is_active', true)
          .single()

        for (const job of jobs) {
          const shouldNotify =
            (job.status === 'completed' && config?.notify_on_success) ||
            (job.status === 'failed' && config?.notify_on_failure)

          if (shouldNotify) {
            const emails = config?.notification_emails as string[] ?? []
            const webhookUrl = config?.webhook_url as string | undefined

            // Log notification (real email integration would go here)
            console.log(`[${AGENT_NAME}] Notification: Job ${job.id} ${job.status}`)
            if (emails.length > 0) {
              console.log(`[${AGENT_NAME}] Would email: ${emails.join(', ')}`)
              // TODO: Integrate with your email provider (Resend, SendGrid, etc.)
            }
            if (webhookUrl) {
              console.log(`[${AGENT_NAME}] Would POST to webhook: ${webhookUrl}`)
              // TODO: Make HTTP POST to webhook URL
            }
          }
        }

        lastCheckedAt = new Date().toISOString()
      }
    } catch (err) {
      console.error(`[${AGENT_NAME}] Error:`, err)
    }

    await sleep(env.AGENT_POLL_INTERVAL_MS * 2) // Check less frequently
  }
}

main().catch(console.error)
