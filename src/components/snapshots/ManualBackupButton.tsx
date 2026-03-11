'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Database, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

export function ManualBackupButton() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const triggerBackup = async () => {
    setState('running')
    setMessage('Starting backup...')
    try {
      const res = await fetch('/api/cron/backup', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}`,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Backup failed')
      setState('done')
      setMessage(`Snapshot created: ${data.snapshot_name} (${data.total_records?.toLocaleString()} records)`)
      setTimeout(() => { setState('idle'); setMessage(''); router.refresh() }, 4000)
    } catch (err: any) {
      setState('error')
      setMessage(err.message ?? 'Backup failed')
      setTimeout(() => { setState('idle'); setMessage('') }, 5000)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={triggerBackup}
        disabled={state === 'running'}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {state === 'running' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Database className="w-4 h-4" />
        )}
        {state === 'running' ? 'Backing up...' : 'Backup Now'}
      </button>

      {message && (
        <div className={`flex items-center gap-1.5 text-sm ${
          state === 'done' ? 'text-green-700' : state === 'error' ? 'text-red-700' : 'text-gray-600'
        }`}>
          {state === 'done' && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
          {state === 'error' && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {message}
        </div>
      )}
    </div>
  )
}
