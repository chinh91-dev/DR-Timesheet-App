import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatRelativeTime, formatDateTime, formatDuration } from '@/lib/utils'
import { ScrollText, CheckCircle2, XCircle } from 'lucide-react'

export default async function LogsPage() {
  const supabase = await createClient()
  const { data: logs } = await supabase
    .from('dr_restore_logs')
    .select('*, dr_snapshots(name, snapshot_timestamp)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Audit Logs</h2>
        <p className="text-sm text-gray-500 mt-1">Complete history of all restore and rollback operations</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!logs || logs.length === 0 ? (
          <div className="text-center py-16">
            <ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No restore operations yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log: any) => {
              const snapshot = log.dr_snapshots as any
              return (
                <div key={log.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {log.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : log.status === 'failed' ? (
                          <XCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-blue-500" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm capitalize">
                          {log.restore_type.replace(/_/g, ' ')}
                          {snapshot && ` → ${snapshot.name}`}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatDateTime(log.created_at)}
                          {log.duration_seconds && ` · ${formatDuration(log.duration_seconds)}`}
                        </div>
                        {log.approval_notes && (
                          <div className="text-xs text-gray-400 italic mt-1">"{log.approval_notes}"</div>
                        )}
                        {log.error_message && (
                          <div className="text-xs text-red-600 mt-1 font-mono bg-red-50 px-2 py-1 rounded">
                            {log.error_message}
                          </div>
                        )}
                        {log.auto_rolled_back && (
                          <div className="text-xs text-orange-600 mt-1 bg-orange-50 px-2 py-1 rounded">
                            ⚠ Auto-rolled back due to validation failure
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <StatusBadge status={log.status} />
                    </div>
                  </div>

                  {/* Row counts */}
                  {log.rows_affected && Object.keys(log.rows_affected).length > 0 && (
                    <div className="mt-2 ml-8 flex flex-wrap gap-2">
                      {Object.entries(log.rows_affected).map(([table, counts]: [string, any]) => (
                        <span key={table} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                          {table}: +{counts.inserted ?? 0} / -{counts.deleted ?? 0}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
