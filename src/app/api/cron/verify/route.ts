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

// Vercel Cron: runs every 30 minutes to verify recently completed snapshots
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const drDb = createAdminClient()
  const storageBucket = process.env.DR_STORAGE_BUCKET ?? 'dr-backups'

  // Find unverified snapshots from the last 24 hours
  const { data: snapshots } = await drDb
    .from('dr_snapshots')
    .select('*')
    .eq('status', 'completed')
    .is('data_hash', null)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(5)

  const results = []

  for (const snapshot of snapshots ?? []) {
    try {
      // Check if file exists in storage
      const { data: fileData, error } = await drDb.storage
        .from(storageBucket)
        .download(`${snapshot.id}/_snapshot.json`)

      if (error || !fileData) {
        await drDb.from('dr_snapshots').update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        }).eq('id', snapshot.id)
        results.push({ id: snapshot.id, valid: false, reason: 'File not found in storage' })
        continue
      }

      const text = await fileData.text()
      const parsed = JSON.parse(text)

      // Basic validation: check tables and record counts match
      const tablesMatch = snapshot.tables_included?.every(
        (t: string) => parsed.data?.[t] !== undefined
      )

      const countsMatch = Object.entries(parsed.record_counts ?? {}).every(
        ([table, count]) => (snapshot.record_counts as Record<string, number>)?.[table] === count
      )

      // Simple hash: length of JSON string (replace with real SHA256 in production)
      const hash = String(text.length)

      await drDb.from('dr_snapshots').update({
        data_hash: hash,
        updated_at: new Date().toISOString(),
      }).eq('id', snapshot.id)

      results.push({
        id: snapshot.id,
        valid: tablesMatch && countsMatch,
        tables_ok: tablesMatch,
        counts_ok: countsMatch,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ id: snapshot.id, valid: false, reason: message })
    }
  }

  return NextResponse.json({ verified: results.length, results })
}
