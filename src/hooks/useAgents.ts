'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Agent } from '@/lib/types/agent'

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAgents = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('dr_agents_health')
      .select('*')
      .order('agent_type')
    setAgents((data ?? []) as Agent[])
    setLoading(false)
  }

  useEffect(() => {
    fetchAgents()
    // Refresh agents every 15 seconds (heartbeat-based)
    const interval = setInterval(fetchAgents, 15000)
    return () => clearInterval(interval)
  }, [])

  const onlineCount = agents.filter(a => a.computed_status === 'online').length

  return { agents, loading, onlineCount, refetch: fetchAgents }
}
