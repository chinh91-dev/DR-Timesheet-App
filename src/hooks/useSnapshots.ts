'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Snapshot } from '@/lib/types/snapshot'

export function useSnapshots(status?: string) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSnapshots = async () => {
    const supabase = createClient()
    let query = supabase
      .from('dr_snapshots')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data } = await query
    setSnapshots((data ?? []) as Snapshot[])
    setLoading(false)
  }

  useEffect(() => {
    fetchSnapshots()
    const supabase = createClient()
    const channel = supabase
      .channel('snapshots-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dr_snapshots' }, () => {
        fetchSnapshots()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [status])

  return { snapshots, loading, refetch: fetchSnapshots }
}
