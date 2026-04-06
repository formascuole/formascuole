interface OreCounterProps {
  oreTotali: number
  orePianificate: number
}

export function OreCounter({ oreTotali, orePianificate }: OreCounterProps) {
  const oreResidue = Math.max(oreTotali - orePianificate, 0)
  const pct = oreTotali > 0 ? Math.min(Math.round((orePianificate / oreTotali) * 100), 100) : 0

  return (
    <div className="bg-[#fbeced] rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-2xl font-bold text-gray-900">{oreTotali}h</div>
          <div className="text-xs text-gray-500 mt-0.5">Totali</div>
        </div>
        <div>
          <div className="text-2xl font-bold" style={{ color: '#d64b55' }}>{orePianificate}h</div>
          <div className="text-xs text-gray-500 mt-0.5">Pianificate</div>
        </div>
        <div>
          <div className={`text-2xl font-bold ${oreResidue === 0 ? 'text-green-600' : 'text-gray-700'}`}>
            {oreResidue}h
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Residue</div>
        </div>
      </div>
      <div className="h-2 bg-white/60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? '#22c55e' : '#d64b55',
          }}
        />
      </div>
      <div className="text-xs text-center text-gray-500">{pct}% completato</div>
    </div>
  )
}
