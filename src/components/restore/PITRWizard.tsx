'use client'
import { useState, useEffect } from 'react'
import { format, subDays, subHours, subMinutes } from 'date-fns'
import {
  Clock, AlertTriangle, CheckCircle2, Loader2, ChevronRight,
  RotateCcw, Calendar, Zap, Info
} from 'lucide-react'

type WizardStep = 'select' | 'confirm' | 'executing' | 'done'

interface CheckpointInfo {
  last_synced_at: string | null
  last_sync_run_at: string | null
  total_entries_synced: number
}

interface PITRResult {
  success: boolean
  restore_log_id: string
  base_snapshot_time: string
  nearest_change_at: string | null
  tables_restored: number
  records_restored: number
  changes_replayed: number
  errors?: string[]
}

const QUICK_TARGETS = [
  { label: '15 minutes ago', fn: () => subMinutes(new Date(), 15) },
  { label: '1 hour ago',     fn: () => subHours(new Date(), 1) },
  { label: '6 hours ago',    fn: () => subHours(new Date(), 6) },
  { label: '24 hours ago',   fn: () => subDays(new Date(), 1) },
  { label: '3 days ago',     fn: () => subDays(new Date(), 3) },
  { label: '7 days ago',     fn: () => subDays(new Date(), 7) },
]

export function PITRWizard() {
  const [step, setStep] = useState<WizardStep>('select')
  const [targetDate, setTargetDate] = useState('')   // date part  YYYY-MM-DD
  const [targetTime, setTargetTime] = useState('')   // time part  HH:mm
  const [confirmText, setConfirmText] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [result, setResult] = useState<PITRResult | null>(null)
  const [checkpoint, setCheckpoint] = useState<CheckpointInfo | null>(null)
  const [loadingCheckpoint, setLoadingCheckpoint] = useState(true)

  // Load checkpoint info to show sync status
  useEffect(() => {
    fetch('/api/pitr/status')
      .then(r => r.json())
      .then(d => { setCheckpoint(d); setLoadingCheckpoint(false) })
      .catch(() => setLoadingCheckpoint(false))
  }, [])

  const targetISO = targetDate && targetTime
    ? new Date(`${targetDate}T${targetTime}`).toISOString()
    : null

  const applyQuickTarget = (fn: () => Date) => {
    const d = fn()
    setTargetDate(format(d, 'yyyy-MM-dd'))
    setTargetTime(format(d, 'HH:mm'))
  }

  const handleExecute = async () => {
    if (!targetISO) return
    setStep('executing')
    setProgress(5)
    setProgressMsg('Starting PITR restore…')

    // Poll progress via simulated steps (real progress comes from API response)
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 3, 88))
    }, 1500)

    try {
      const res = await fetch('/api/restore/pitr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_timestamp: targetISO }),
      })
      const data: PITRResult = await res.json()
      clearInterval(interval)
      setProgress(100)
      setProgressMsg('Complete')
      setResult(data)
      setStep('done')
    } catch (err: any) {
      clearInterval(interval)
      setResult({ success: false, restore_log_id: '', base_snapshot_time: '', nearest_change_at: null, tables_restored: 0, records_restored: 0, changes_replayed: 0, errors: [err.message] })
      setStep('done')
    }
  }

  const reset = () => {
    setStep('select')
    setTargetDate('')
    setTargetTime('')
    setConfirmText('')
    setProgress(0)
    setResult(null)
  }

  // ── Step: Select ──
  if (step === 'select') {
    return (
      <div className="space-y-6">
        {/* Sync status banner */}
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
          checkpoint?.last_synced_at ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {loadingCheckpoint ? (
            <span>Checking change log sync status…</span>
          ) : checkpoint?.last_synced_at ? (
            <span>
              Change log synced up to <strong>{format(new Date(checkpoint.last_synced_at), 'dd MMM yyyy, h:mm:ss a')}</strong>.
              {' '}Total entries: {checkpoint.total_entries_synced?.toLocaleString()}.
              You can recover to any second before this time.
            </span>
          ) : (
            <span>
              <strong>Change log not yet synced.</strong> Run migration 006 on your source DB, then trigger a manual sync.
              Until then, only full-snapshot restore is available.
            </span>
          )}
        </div>

        {/* Quick targets */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Quick targets</div>
          <div className="flex flex-wrap gap-2">
            {QUICK_TARGETS.map(qt => (
              <button
                key={qt.label}
                onClick={() => applyQuickTarget(qt.fn)}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 rounded-lg transition-colors"
              >
                {qt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date + time picker */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Or choose a precise moment</div>
          <div className="flex gap-3 items-center">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={targetDate}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => setTargetDate(e.target.value)}
                className="pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="time"
                value={targetTime}
                step="1"
                onChange={e => setTargetTime(e.target.value)}
                className="pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Selected target preview */}
        {targetISO && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs text-blue-600 font-medium mb-1">Recovery target</div>
            <div className="text-lg font-semibold text-blue-900">
              {format(new Date(targetISO), 'EEEE, dd MMMM yyyy')}
            </div>
            <div className="text-2xl font-bold text-blue-700 mt-0.5">
              {format(new Date(targetISO), 'h:mm:ss a')}
            </div>
            <div className="text-xs text-blue-500 mt-2 font-mono">{targetISO}</div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            disabled={!targetISO}
            onClick={() => setStep('confirm')}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // ── Step: Confirm ──
  if (step === 'confirm') {
    return (
      <div className="space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-800 mb-1">This will overwrite live data</div>
            <div className="text-sm text-amber-700">
              All data in the source database will be replaced with the state it was in at{' '}
              <strong>{format(new Date(targetISO!), 'dd MMM yyyy, h:mm:ss a')}</strong>.
              A safety snapshot will be created first so you can undo this operation.
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Recovery target</span>
            <span className="font-medium text-gray-900">{format(new Date(targetISO!), 'dd MMM yyyy, h:mm:ss a')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Method</span>
            <span className="font-medium text-gray-900">Point-in-Time Recovery (snapshot + change log replay)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Safety snapshot</span>
            <span className="font-medium text-green-700">Auto-created before restore</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Type <span className="font-mono font-bold">RESTORE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="RESTORE"
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={() => setStep('select')} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Back
          </button>
          <button
            disabled={confirmText !== 'RESTORE'}
            onClick={handleExecute}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Execute PITR Restore
          </button>
        </div>
      </div>
    )
  }

  // ── Step: Executing ──
  if (step === 'executing') {
    return (
      <div className="space-y-6 py-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <div className="text-lg font-semibold text-gray-900">PITR Restore in Progress</div>
          <div className="text-sm text-gray-500 mt-1">
            Recovering to {targetISO ? format(new Date(targetISO), 'dd MMM yyyy, h:mm:ss a') : ''}
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>{progressMsg}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="text-xs text-gray-400 text-center">
          This may take several minutes depending on the amount of data and changes to replay.
        </div>
      </div>
    )
  }

  // ── Step: Done ──
  if (step === 'done' && result) {
    const success = result.success
    return (
      <div className="space-y-5">
        <div className={`flex items-start gap-3 rounded-xl border p-4 ${
          success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          {success
            ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            : <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          }
          <div>
            <div className={`font-semibold text-sm ${success ? 'text-green-800' : 'text-red-800'}`}>
              {success ? 'Point-in-Time Recovery complete' : 'PITR restore encountered errors'}
            </div>
            {result.nearest_change_at && (
              <div className="text-sm text-green-700 mt-0.5">
                Data restored to <strong>{format(new Date(result.nearest_change_at), 'dd MMM yyyy, h:mm:ss a')}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 text-xs mb-0.5">Base snapshot used</div>
            <div className="font-medium">{result.base_snapshot_time ? format(new Date(result.base_snapshot_time), 'dd MMM yyyy, h:mm a') : '—'}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-0.5">Changes replayed</div>
            <div className="font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-500" />
              {result.changes_replayed.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-0.5">Tables restored</div>
            <div className="font-medium">{result.tables_restored}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-0.5">Records restored</div>
            <div className="font-medium">{result.records_restored.toLocaleString()}</div>
          </div>
        </div>

        {result.errors && result.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-red-700 mb-2">Errors during restore</div>
            <ul className="text-xs text-red-600 space-y-1">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        <button
          onClick={reset}
          className="w-full py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Perform another recovery
        </button>
      </div>
    )
  }

  return null
}
