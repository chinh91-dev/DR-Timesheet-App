import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Returns current PITR sync status — used by the PITRWizard banner
export async function GET() {
  const drDb = createAdminClient()

  const { data, error } = await drDb
    .from('dr_pitr_checkpoints')
    .select('last_synced_id, last_synced_at, last_sync_run_at, total_entries_synced')
    .eq('source_label', 'time-team-tracker')
    .single()

  if (error || !data) {
    return NextResponse.json({
      last_synced_at: null,
      last_sync_run_at: null,
      total_entries_synced: 0,
      ready: false,
    })
  }

  return NextResponse.json({
    ...data,
    ready: !!data.last_synced_at,
  })
}
