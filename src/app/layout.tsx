import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DR Timesheet — Disaster Recovery',
  description: 'Point-in-time backup and recovery for your timesheet database',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
