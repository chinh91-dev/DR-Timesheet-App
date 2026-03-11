'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Loader2, AlertTriangle } from 'lucide-react'

interface RollbackButtonProps {
  restoreLogId: string
  snapshotName?: string
}

export function RollbackButton({ restoreLogId, snapshotName }: RollbackButtonProps) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRollback = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/restore/${restoreLogId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Rollback failed')
      setShowConfirm(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? 'Rollback failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
      >
        <RotateCcw className="w-3 h-3" /> Rollback
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Rollback this restore?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will undo the restore of <strong>{snapshotName ?? 'this snapshot'}</strong> and
              revert your database to the state before that restore was performed.
            </p>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-3">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setError('') }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {loading ? 'Rolling back...' : 'Confirm Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
