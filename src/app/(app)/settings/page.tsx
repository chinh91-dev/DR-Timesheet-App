import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/settings/SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: config } = await supabase
    .from('dr_backup_config')
    .select('*')
    .eq('config_name', 'default')
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure backup schedules, retention policies, and notifications</p>
      </div>
      <SettingsForm initialConfig={config} />
    </div>
  )
}
