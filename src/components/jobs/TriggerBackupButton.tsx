'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

export function TriggerBackupButton() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [detail, setDetail] = useState('')

  const trigger = async () => {
    setState('running')
    try {
      const res = await fetch('/api/cron/backup')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setState('done')
      setDetail(`${data.tables_backed_up} tables · ${data.total_records?.toLocaleString()} records`)
      setTimeout(() => { setState('idle'); setDetail(''); router.refresh() }, 5000)
    } catch (err: any) {
      setState('error')
      setDetail(err.message)
      setTimeout(() => { setState('idle'); setDetail('') }, 5000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {detail && (
        <span className={`text-xs ${state === 'done' ? 'text-green-600' : 'text-red-600'}`}>
          {state === 'done' ? <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
          {detail}
        </span>
      )}
      <button
        onClick={trigger}
        disabled={state === 'running'}
        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
      >
        {state === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {state === 'running' ? 'Running...' : 'Run Backup Now'}
      </button>
    </div>
  )
}
