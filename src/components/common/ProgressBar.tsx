interface ProgressBarProps {
  value: number
  label?: string
  className?: string
  color?: string
}

export function ProgressBar({ value, label, className = '', color = 'bg-blue-600' }: ProgressBarProps) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{label}</span>
          <span>{Math.round(value)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}
