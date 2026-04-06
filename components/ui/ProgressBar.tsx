interface ProgressBarProps {
  value: number // 0-100
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  color?: string
}

export function ProgressBar({ value, size = 'md', showLabel = false, color }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100)
  const heightClass = size === 'sm' ? 'h-1.5' : size === 'md' ? 'h-2' : 'h-3'
  const bgColor = color || (clamped >= 100 ? '#22c55e' : '#d64b55')

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-gray-100 rounded-full overflow-hidden ${heightClass}`}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${clamped}%`, backgroundColor: bgColor }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 min-w-[32px] text-right">{clamped}%</span>
      )}
    </div>
  )
}
