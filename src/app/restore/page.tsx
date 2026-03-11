import { createClient } from '@/lib/supabase/server'
import { RestoreWizard } from '@/components/restore/RestoreWizard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatRelativeTime, formatDateTime, formatBytes } from '@/lib/utils'
import { RollbackButton } from '@/components/restore/RollbackButton'

export default async function RestorePage() {
  const supabase = await createClient()
  const { data: snapshots } = await supabase
    .from('dr_snapshots')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const { data: restoreLogs } = await supabase
    .from('dr_restore_logs')
    .select('*, dr_snapshots(name)')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Restore Database</h2>
        <p className="text-sm text-gray-500 mt-1">Select a snapshot to restore your timesheet database to a previous state</p>
      </div>

      {/* Restore Wizard */}
      <RestoreWizard snapshots={snapshots ?? []} />

      {/* Recent Restore History */}
      {restoreLogs && restoreLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Restore History</h3>
          <div className="space-y-3">
            {restoreLogs.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {(log.dr_snapshots as any)?.name ?? 'Unknown snapshot'}
                  </div>
                  <div className="text-xs text-gray-500">{formatDateTime(log.created_at)}</div>
                  {log.approval_notes && (
                    <div className="text-xs text-gray-400 italic mt-0.5">"{log.approval_notes}"</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 capitalize">{log.restore_type.replace(/_/g, ' ')}</span>
                  <StatusBadge status={log.status} />
                  {log.status === 'completed' && log.safety_snapshot_id && (
                    <RollbackButton restoreLogId={log.id} snapshotName={(log.dr_snapshots as any)?.name} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
