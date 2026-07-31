interface StatCardProps {
  label: string
  value: string | number
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  trend?: { value: number; label: string }
}

export function StatCard({ label, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <div
      className="bg-white rounded-xl p-5 flex flex-col gap-3"
      style={{ border: '0.5px solid #e5e5e5' }}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div>
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        {subtitle && <div className="text-sm text-gray-400 mt-0.5">{subtitle}</div>}
      </div>
      {trend && (
        <div className="text-xs text-gray-400">
          <span className={trend.value >= 0 ? 'text-green-600' : 'text-red-500'}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>{' '}
          {trend.label}
        </div>
      )}
    </div>
  )
}
