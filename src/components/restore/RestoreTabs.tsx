'use client'
import { useState } from 'react'
import { Database, Clock } from 'lucide-react'
import { RestoreWizard } from './RestoreWizard'
import { PITRWizard } from './PITRWizard'

export function RestoreTabs({ snapshots }: { snapshots: any[] }) {
  const [tab, setTab] = useState<'snapshot' | 'pitr'>('snapshot')

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Tab header */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('snapshot')}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'snapshot'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Database className="w-4 h-4" />
          Snapshot Restore
        </button>
        <button
          onClick={() => setTab('pitr')}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'pitr'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          Point-in-Time Recovery
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">PITR</span>
        </button>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {tab === 'snapshot' ? (
          <>
            <div className="mb-5">
              <div className="text-sm font-medium text-gray-900">Restore from a full snapshot</div>
              <div className="text-sm text-gray-500 mt-0.5">
                Select any previously created snapshot to restore your database to that exact backup point.
              </div>
            </div>
            <RestoreWizard snapshots={snapshots} />
          </>
        ) : (
          <>
            <div className="mb-5">
              <div className="text-sm font-medium text-gray-900">Recover to any precise moment</div>
              <div className="text-sm text-gray-500 mt-0.5">
                Uses a full snapshot as the base, then replays your continuous change log to restore data
                to the exact second you specify — not just a backup timestamp.
              </div>
            </div>
            <PITRWizard />
          </>
        )}
      </div>
    </div>
  )
}
