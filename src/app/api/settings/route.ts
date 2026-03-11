import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { error } = await supabase
      .from('dr_backup_config')
      .update({
        schedule_cron: body.schedule_cron,
        schedule_description: body.schedule_description,
        backup_enabled: body.backup_enabled,
        retention_days: body.retention_days,
        retention_versions: body.retention_versions,
        included_tables: body.included_tables,
        notify_on_success: body.notify_on_success,
        notify_on_failure: body.notify_on_failure,
        notification_emails: body.notification_emails,
        webhook_url: body.webhook_url,
        updated_at: new Date().toISOString(),
      })
      .eq('config_name', 'default')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
