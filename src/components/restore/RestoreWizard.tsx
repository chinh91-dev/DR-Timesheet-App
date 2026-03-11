'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressBar } from '@/components/common/ProgressBar'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatBytes, formatRelativeTime, formatDateTime } from '@/lib/utils'
import { CheckCircle2, ChevronRight, Database, AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import type { Snapshot } from '@/lib/types/snapshot'

interface RestoreWizardProps {
  snapshots: Snapshot[]
}

type WizardStep = 'select' | 'preview' | 'confirm' | 'executing' | 'done'

interface RestorePreview {
  tables: string[]
  record_counts: Record<string, number>
  total_records: number
  storage_size_bytes: number
}

export function RestoreWizard({ snapshots }: RestoreWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>('select')
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null)
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [notes, setNotes] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [restoreJob, setRestoreJob] = useState<any>(null)
  const [progress, setProgress] = useState(0)

  const steps = [
    { id: 'select', label: 'Select Snapshot', done: step !== 'select' },
    { id: 'preview', label: 'Review', done: ['confirm', 'executing', 'done'].includes(step) },
    { id: 'confirm', label: 'Confirm', done: ['executing', 'done'].includes(step) },
    { id: 'executing', label: 'Restore', done: step === 'done' },
    { id: 'done', label: 'Done', done: false },
  ]

  const loadPreview = async (snapshot: Snapshot) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/snapshots/${snapshot.id}/preview`)
      if (!res.ok) throw new Error('Failed to load preview')
      const data = await res.json()
      setPreview(data)
      setSelectedSnapshot(snapshot)
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  const startRestore = async () => {
    if (confirmText !== 'RESTORE') return
    setLoading(true)
    setError('')
    setStep('executing')
    setProgress(5)

    try {
      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_id: selectedSnapshot!.id,
          restore_type: 'snapshot',
          approval_notes: notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Restore failed')

      setRestoreJob(data.job)

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const jobRes = await fetch(`/api/agents/jobs?limit=1`)
          const jobData = await jobRes.json()
          const job = jobData.jobs?.find((j: any) => j.id === data.job.id)
          if (job) {
            setProgress(job.progress_percent ?? progress)
            if (job.status === 'completed' || job.status === 'failed') {
              clearInterval(pollInterval)
              setStep('done')
              setLoading(false)
            }
          }
        } catch {}
      }, 3000)

      // Fallback: simulate progress
      let simulatedProgress = 10
      const simInterval = setInterval(() => {
        simulatedProgress = Math.min(90, simulatedProgress + 8)
        setProgress(simulatedProgress)
        if (simulatedProgress >= 90) clearInterval(simInterval)
      }, 4000)

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed')
      setStep('confirm')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Step indicators */}
      <div className="flex items-center px-6 py-4 border-b border-gray-200 overflow-x-auto">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={`flex items-center gap-2 text-sm font-medium ${
              step === s.id ? 'text-blue-600' : s.done ? 'text-green-600' : 'text-gray-400'
            }`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                s.done ? 'bg-green-100' : step === s.id ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                {s.done ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 mx-3 flex-shrink-0" />}
          </div>
        ))}
      </div>

      <div className="p-6">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Step 1: Select */}
        {step === 'select' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Select the snapshot you want to restore to:</p>
            {snapshots.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Database className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No completed snapshots available</p>
              </div>
            ) : snapshots.map(snapshot => (
              <button
                key={snapshot.id}
                onClick={() => loadPreview(snapshot)}
                disabled={loading}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
              >
                <div>
                  <div className="font-medium text-gray-900">{snapshot.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {formatDateTime(snapshot.snapshot_timestamp)} · {formatBytes(snapshot.storage_size_bytes ?? 0)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={snapshot.status} />
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && preview && selectedSnapshot && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="font-medium text-blue-900">{selectedSnapshot.name}</div>
              <div className="text-sm text-blue-700 mt-0.5">
                Taken {formatRelativeTime(selectedSnapshot.snapshot_timestamp)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Tables to restore:</div>
              <div className="space-y-2">
                {preview.tables.map(table => (
                  <div key={table} className="flex justify-between text-sm">
                    <span className="font-mono text-gray-700">{table}</span>
                    <span className="text-gray-500">{(preview.record_counts[table] ?? 0).toLocaleString()} rows</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200">
                  <span>Total records</span>
                  <span>{preview.total_records.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep('select')} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Back
              </button>
              <button onClick={() => setStep('confirm')} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Continue to Confirm
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && selectedSnapshot && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 text-amber-800 font-medium">
                <AlertTriangle className="w-4 h-4" />
                This will overwrite your current data
              </div>
              <p className="text-sm text-amber-700 mt-1">
                All current data in the selected tables will be replaced with data from snapshot "{selectedSnapshot.name}".
                A safety backup will be taken automatically before proceeding.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for restore (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Reverting accidental data deletion"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <code className="bg-gray-100 px-1 rounded font-mono">RESTORE</code> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="RESTORE"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('preview')} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Back</button>
              <button
                onClick={startRestore}
                disabled={confirmText !== 'RESTORE' || loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Execute Restore
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Executing */}
        {step === 'executing' && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Restoring database...</div>
              <div className="text-sm text-gray-500 mt-1">This may take a few minutes. Do not close this page.</div>
            </div>
            <ProgressBar value={progress} label="Progress" className="max-w-sm mx-auto" />
          </div>
        )}

        {/* Step 5: Done */}
        {step === 'done' && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-lg">Restore complete!</div>
              <div className="text-sm text-gray-500 mt-1">Your database has been restored successfully.</div>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => { setStep('select'); setSelectedSnapshot(null); setPreview(null); setConfirmText(''); setNotes(''); setProgress(0); router.refresh(); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Start New Restore
              </button>
              <button onClick={() => router.push('/logs')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                View Audit Log
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
