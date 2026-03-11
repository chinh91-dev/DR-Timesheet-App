import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatRelativeTime(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true })
  } catch {
    return dateString
  }
}

export function formatDateTime(dateString: string): string {
  try {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm:ss')
  } catch {
    return dateString
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: 'text-green-600',
    online: 'text-green-600',
    success: 'text-green-600',
    failed: 'text-red-600',
    error: 'text-red-600',
    offline: 'text-gray-400',
    cancelled: 'text-gray-400',
    in_progress: 'text-blue-600',
    pending: 'text-yellow-600',
    queued: 'text-yellow-600',
    degraded: 'text-orange-500',
    validating: 'text-blue-400',
    retrying: 'text-orange-500',
  }
  return colors[status] ?? 'text-gray-600'
}

export function getStatusBgColor(status: string): string {
  const colors: Record<string, string> = {
    completed: 'bg-green-50 text-green-700 border-green-200',
    online: 'bg-green-50 text-green-700 border-green-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    offline: 'bg-gray-50 text-gray-600 border-gray-200',
    cancelled: 'bg-gray-50 text-gray-600 border-gray-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    queued: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    degraded: 'bg-orange-50 text-orange-700 border-orange-200',
    validating: 'bg-blue-50 text-blue-600 border-blue-100',
    retrying: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  return colors[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function generateSnapshotName(): string {
  const now = new Date()
  return `snapshot-${format(now, 'yyyy-MM-dd-HHmmss')}`
}
