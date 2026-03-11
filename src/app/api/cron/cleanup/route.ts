import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return authHeader === `Bearer ${cronSecret}`
}

// Vercel Cron: runs daily to enforce retention policy
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const drDb = createAdminClient()
  const storageBucket = process.env.DR_STORAGE_BUCKET ?? 'dr-backups'

  // Get config
  const { data: config } = await drDb
    .from('dr_backup_config')
    .select('*')
    .eq('is_active', true)
    .single()

  const retentionDays = config?.retention_days ?? 30
  const retentionVersions = config?.retention_versions ?? 10

  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

  // Find snapshots older than retention period (keep at least retentionVersions)
  const { data: allSnapshots } = await drDb
    .from('dr_snapshots')
    .select('id, created_at, storage_path')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (!allSnapshots || allSnapshots.length <= retentionVersions) {
    return NextResponse.json({ deleted: 0, message: 'Nothing to clean up' })
  }

  // Keep the most recent `retentionVersions`, delete old ones past retention period
  const toKeep = allSnapshots.slice(0, retentionVersions)
  const keepIds = new Set(toKeep.map(s => s.id))

  const toDelete = allSnapshots.filter(
    s => !keepIds.has(s.id) && s.created_at < cutoffDate
  )

  let deletedCount = 0
  for (const snapshot of toDelete) {
    // Delete from storage
    await drDb.storage.from(storageBucket).remove([`${snapshot.id}/_snapshot.json`])
    // Delete record
    await drDb.from('dr_snapshots').delete().eq('id', snapshot.id)
    deletedCount++
  }

  return NextResponse.json({
    deleted: deletedCount,
    kept: allSnapshots.length - deletedCount,
    retention_days: retentionDays,
    retention_versions: retentionVersions,
  })
}
