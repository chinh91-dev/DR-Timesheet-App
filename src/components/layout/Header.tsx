'use client'
import { Bell, RefreshCw } from 'lucide-react'
import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/snapshots': 'Snapshots',
  '/restore': 'Restore',
  '/agents': 'Agents',
  '/agents/jobs': 'Job Queue',
  '/logs': 'Audit Logs',
  '/settings': 'Settings',
}

export function Header() {
  const pathname = usePathname()
  const title = pageTitles[pathname] ?? 'DR Console'

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <button
          onClick={() => window.location.reload()}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
          DR
        </div>
      </div>
    </header>
  )
}
