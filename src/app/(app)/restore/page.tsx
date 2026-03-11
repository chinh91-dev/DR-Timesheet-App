import { createClient } from '@/lib/supabase/server'
import { RestoreWizard } from '@/components/restore/RestoreWizard'
import { PITRWizard } from '@/components/restore/PITRWizard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatDateTime } from '@/lib/utils'
import { RollbackButton } from '@/components/restore/RollbackButton'
import { RestoreTabs } from '@/components/restore/RestoreTabs'

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
    .limit(20)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Restore Database</h2>
        <p className="text-sm text-gray-500 mt-1">
          Restore from a full snapshot or recover to any precise moment using Point-in-Time Recovery
        </p>
      </div>

      {/* Tabbed restore wizards */}
      <RestoreTabs snapshots={snapshots ?? []} />

      {/* Restore History */}
      {restoreLogs && restoreLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Restore History</h3>
          <div className="space-y-3">
            {restoreLogs.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {(log.dr_snapshots as any)?.name ?? log.restore_type === 'pitr' ? 'PITR Restore' : 'Unknown snapshot'}
                    </span>
                    {log.restore_type === 'pitr' && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">PITR</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{formatDateTime(log.created_at)}</div>
                  {log.restore_metadata?.target_time && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      Target: {new Date(log.restore_metadata.target_time).toLocaleString()}
                      {log.restore_metadata.changes_replayed != null && (
                        <span className="ml-2">· {log.restore_metadata.changes_replayed} changes replayed</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={log.status} />
                  {log.status === 'completed' && log.safety_snapshot_id && (
                    <RollbackButton restoreLogId={log.id} snapshotName={(log.dr_snapshots as any)?.name ?? 'PITR restore'} />
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
