#!/usr/bin/env tsx
/**
 * Agent Bootstrap — starts all agent workers as child processes
 * Run with: npm run agents
 */

import { spawn, ChildProcess } from 'child_process'
import path from 'path'

const AGENTS = [
  { name: 'backup-agent', file: 'backup-agent.ts' },
  { name: 'restore-agent', file: 'restore-agent.ts' },
  { name: 'verify-agent', file: 'verify-agent.ts' },
  { name: 'notify-agent', file: 'notify-agent.ts' },
]

const processes: Map<string, ChildProcess> = new Map()

function spawnAgent(name: string, file: string): ChildProcess {
  const agentPath = path.join(__dirname, file)
  console.log(`[bootstrap] Starting ${name}...`)

  const proc = spawn('tsx', [agentPath], {
    stdio: 'inherit',
    env: { ...process.env },
  })

  proc.on('exit', (code, signal) => {
    console.log(`[bootstrap] ${name} exited (code=${code}, signal=${signal})`)
    processes.delete(name)

    // Auto-restart after 5 seconds if unexpected exit
    if (code !== 0 && signal !== 'SIGTERM') {
      console.log(`[bootstrap] Restarting ${name} in 5s...`)
      setTimeout(() => {
        const newProc = spawnAgent(name, file)
        processes.set(name, newProc)
      }, 5000)
    }
  })

  return proc
}

// Start all agents
for (const agent of AGENTS) {
  const proc = spawnAgent(agent.name, agent.file)
  processes.set(agent.name, proc)
}

console.log(`[bootstrap] All ${AGENTS.length} agents started`)

// Graceful shutdown: forward SIGTERM to all children
const shutdown = () => {
  console.log('[bootstrap] Shutting down all agents...')
  for (const [name, proc] of processes) {
    console.log(`[bootstrap] Stopping ${name}...`)
    proc.kill('SIGTERM')
  }
  setTimeout(() => process.exit(0), 3000)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
