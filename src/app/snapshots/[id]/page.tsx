import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatBytes, formatDateTime, formatRelativeTime } from '@/lib/utils'
import { ArrowLeft, RotateCcw, Database, Table } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SnapshotDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: snapshot, error } = await supabase
    .from('dr_snapshots')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !snapshot) notFound()

  const tables = snapshot.tables_included as string[] ?? []
  const recordCounts = snapshot.record_counts as Record<string, number> ?? {}
  const totalRecords = Object.values(recordCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/snapshots" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Snapshots
          </Link>
          <h2 className="text-xl font-semibold text-gray-900">{snapshot.name}</h2>
          {snapshot.description && (
            <p className="text-sm text-gray-500 mt-1">{snapshot.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={snapshot.status} />
          {snapshot.status === 'completed' && (
            <Link
              href={`/restore?snapshot=${snapshot.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <RotateCcw className="w-4 h-4" /> Restore This Snapshot
            </Link>
          )}
        </div>
      </div>

      {/* Metadata Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <InfoCard label="Snapshot Time" value={formatDateTime(snapshot.snapshot_timestamp)} />
        <InfoCard label="Storage Size" value={formatBytes(snapshot.storage_size_bytes ?? 0)} />
        <InfoCard label="Total Records" value={totalRecords.toLocaleString()} />
        <InfoCard label="Tables" value={String(tables.length)} />
      </div>

      {/* Table Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Table Breakdown</h3>
        {tables.length === 0 ? (
          <p className="text-sm text-gray-500">No table data available</p>
        ) : (
          <div className="space-y-3">
            {tables.map(table => {
              const count = recordCounts[table] ?? 0
              const maxCount = Math.max(...Object.values(recordCounts))
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
              return (
                <div key={table}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <Table className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-mono text-gray-700">{table}</span>
                    </div>
                    <span className="text-gray-500">{count.toLocaleString()} rows</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Details</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Detail label="Snapshot ID" value={snapshot.id} mono />
          <Detail label="Type" value={snapshot.snapshot_type} />
          <Detail label="Storage Path" value={snapshot.storage_path ?? '—'} mono />
          <Detail label="Data Hash" value={snapshot.data_hash ? snapshot.data_hash.slice(0, 16) + '...' : '—'} mono />
          <Detail label="Created" value={formatRelativeTime(snapshot.created_at)} />
          <Detail label="Last Updated" value={formatRelativeTime(snapshot.updated_at)} />
        </dl>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className={`mt-1 text-sm text-gray-900 ${mono ? 'font-mono break-all' : ''}`}>{value}</dd>
    </div>
  )
}
