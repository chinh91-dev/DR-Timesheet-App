import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatBytes, formatRelativeTime, formatDateTime } from '@/lib/utils'
import { Database, Plus, Eye, RotateCcw } from 'lucide-react'
import { CreateSnapshotButton } from '@/components/snapshots/CreateSnapshotButton'

export default async function SnapshotsPage() {
  const supabase = await createClient()
  const { data: snapshots, error } = await supabase
    .from('dr_snapshots')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Snapshots</h2>
          <p className="text-sm text-gray-500 mt-1">Browse and manage all database backup snapshots</p>
        </div>
        <CreateSnapshotButton />
      </div>

      {/* Snapshot List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!snapshots || snapshots.length === 0 ? (
          <div className="text-center py-16">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No snapshots yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first snapshot to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {snapshots.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 text-sm">{s.name}</div>
                    {s.description && <div className="text-xs text-gray-500 mt-0.5">{s.description}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 capitalize">{s.snapshot_type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{formatBytes(s.storage_size_bytes ?? 0)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">{formatRelativeTime(s.created_at)}</div>
                    <div className="text-xs text-gray-400">{formatDateTime(s.created_at)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/snapshots/${s.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <Eye className="w-3 h-3" /> View
                      </Link>
                      {s.status === 'completed' && (
                        <Link
                          href={`/restore?snapshot=${s.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50"
                        >
                          <RotateCcw className="w-3 h-3" /> Restore
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
