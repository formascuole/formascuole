interface DualProgressBarProps {
  oreTotali: number
  orePianificate: number
  oreErogate: number
  size?: 'sm' | 'lg'
}

export function DualProgressBar({ oreTotali, orePianificate, oreErogate, size = 'sm' }: DualProgressBarProps) {
  const pctPian = oreTotali > 0 ? Math.min(Math.round((orePianificate / oreTotali) * 100), 100) : 0
  const pctEro = oreTotali > 0 ? Math.min(Math.round((oreErogate / oreTotali) * 100), 100) : 0
  const h = size === 'lg' ? 'h-2.5' : 'h-1.5'

  return (
    <div className="space-y-1.5">
      <div>
        <div className="flex justify-between items-baseline mb-0.5">
          <span className="text-[11px] text-gray-500">Pianificate</span>
          <span className="text-[11px] font-medium text-gray-700">{orePianificate}/{oreTotali}h ({pctPian}%)</span>
        </div>
        <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${h}`}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pctPian}%`, backgroundColor: '#378ADD' }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between items-baseline mb-0.5">
          <span className="text-[11px] text-gray-500">Erogate</span>
          <span className="text-[11px] font-medium" style={{ color: pctEro > 0 ? '#1D9E75' : '#9ca3af' }}>
            {oreErogate}/{oreTotali}h ({pctEro}%)
          </span>
        </div>
        <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${h}`}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pctEro}%`, backgroundColor: '#1D9E75' }} />
        </div>
      </div>
    </div>
  )
}
