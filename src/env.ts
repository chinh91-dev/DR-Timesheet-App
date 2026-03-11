export const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  BACKUP_TABLES: (process.env.BACKUP_TABLES ?? 'timesheets,employees,projects,clients,time_entries').split(',').map(t => t.trim()),
  AGENT_POLL_INTERVAL_MS: parseInt(process.env.AGENT_POLL_INTERVAL_MS ?? '5000'),
  AGENT_HEARTBEAT_INTERVAL_MS: parseInt(process.env.AGENT_HEARTBEAT_INTERVAL_MS ?? '30000'),
  MAX_CONCURRENT_JOBS: parseInt(process.env.MAX_CONCURRENT_JOBS ?? '3'),
} as const
