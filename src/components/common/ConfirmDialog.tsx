'use client'
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  dangerous?: boolean
  requireTyping?: string
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  dangerous = false,
  requireTyping,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const canConfirm = !requireTyping || typedValue === requireTyping

  const handleConfirm = async () => {
    if (!canConfirm) return
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
      setTypedValue('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${dangerous ? 'bg-red-100' : 'bg-blue-100'}`}>
          <AlertTriangle className={`w-6 h-6 ${dangerous ? 'text-red-600' : 'text-blue-600'}`} />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{description}</p>

        {requireTyping && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Type <code className="bg-gray-100 px-1 rounded">{requireTyping}</code> to confirm:
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={requireTyping}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              dangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
