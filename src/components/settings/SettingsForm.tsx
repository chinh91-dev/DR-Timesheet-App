'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2 } from 'lucide-react'

interface SettingsFormProps {
  initialConfig: any
}

export function SettingsForm({ initialConfig }: SettingsFormProps) {
  const router = useRouter()
  const [config, setConfig] = useState(initialConfig ?? {})
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const update = (key: string, value: unknown) => setConfig((c: any) => ({ ...c, [key]: value }))

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); router.refresh() }
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      {/* Backup Schedule */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Backup Schedule</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (cron expression)</label>
            <input
              type="text"
              value={config.schedule_cron ?? '0 2 * * *'}
              onChange={e => update('schedule_cron', e.target.value)}
              placeholder="0 2 * * *"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Default: 0 2 * * * (daily at 2am)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule description</label>
            <input
              type="text"
              value={config.schedule_description ?? ''}
              onChange={e => update('schedule_description', e.target.value)}
              placeholder="Daily at 2:00 AM"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <input
            type="checkbox"
            id="backup_enabled"
            checked={config.backup_enabled ?? true}
            onChange={e => update('backup_enabled', e.target.checked)}
            className="rounded border-gray-300 text-blue-600"
          />
          <label htmlFor="backup_enabled" className="text-sm text-gray-700">Enable scheduled backups</label>
        </div>
      </div>

      {/* Retention Policy */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Retention Policy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Retention period (days)</label>
            <input
              type="number"
              value={config.retention_days ?? 30}
              onChange={e => update('retention_days', parseInt(e.target.value))}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum versions to keep</label>
            <input
              type="number"
              value={config.retention_versions ?? 10}
              onChange={e => update('retention_versions', parseInt(e.target.value))}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Tables to Backup</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Included tables (comma-separated)</label>
          <input
            type="text"
            value={Array.isArray(config.included_tables) ? config.included_tables.join(', ') : ''}
            onChange={e => update('included_tables', e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean))}
            placeholder="timesheets, employees, projects"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Notifications</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="notify_success"
              checked={config.notify_on_success ?? false}
              onChange={e => update('notify_on_success', e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="notify_success" className="text-sm text-gray-700">Notify on successful backup</label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="notify_failure"
              checked={config.notify_on_failure ?? true}
              onChange={e => update('notify_on_failure', e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="notify_failure" className="text-sm text-gray-700">Notify on backup failure</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notification emails (comma-separated)</label>
            <input
              type="text"
              value={Array.isArray(config.notification_emails) ? config.notification_emails.join(', ') : ''}
              onChange={e => update('notification_emails', e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean))}
              placeholder="admin@example.com, backup@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL (optional)</label>
            <input
              type="url"
              value={config.webhook_url ?? ''}
              onChange={e => update('webhook_url', e.target.value)}
              placeholder="https://hooks.slack.com/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✓ Saved successfully</span>}
      </div>
    </div>
  )
}
