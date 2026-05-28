interface OreCounterProps {
  oreTotali: number
  orePianificate: number
  oreErogate?: number
  sessioniCompletate?: number
  sessioniTotali?: number
}

export function OreCounter({ oreTotali, orePianificate, oreErogate, sessioniCompletate, sessioniTotali }: OreCounterProps) {
  const oreResidue = Math.max(oreTotali - orePianificate, 0)
  const pct = oreTotali > 0 ? Math.min(Math.round((orePianificate / oreTotali) * 100), 100) : 0
  const showSessioni = sessioniTotali !== undefined && sessioniTotali > 0
  const showErogate = oreErogate !== undefined

  const hasSessioniScadute = showSessioni &&
    sessioniCompletate !== undefined &&
    sessioniCompletate < sessioniTotali!

  const colClass = showErogate && showSessioni ? 'grid-cols-5' : (showErogate || showSessioni) ? 'grid-cols-4' : 'grid-cols-3'

  return (
    <div className="bg-[#fbeced] rounded-lg p-4 space-y-3">
      <div className={`grid gap-3 text-center ${colClass}`}>
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
        {showErogate && (
          <div>
            <div className={`text-2xl font-bold ${oreErogate! >= oreTotali ? 'text-green-600' : oreErogate! > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
              {oreErogate}h
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Erogate</div>
          </div>
        )}
        {showSessioni && (
          <div>
            <div className={`text-2xl font-bold ${sessioniCompletate === sessioniTotali ? 'text-green-600' : hasSessioniScadute ? 'text-amber-600' : 'text-gray-700'}`}>
              {sessioniCompletate}/{sessioniTotali}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Sessioni ✓</div>
          </div>
        )}
      </div>
      {showErogate ? (
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-600">Pianificate</span>
              <span className="font-medium text-gray-700">{pct}%</span>
            </div>
            <div className="h-2 bg-white/60 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: '#378ADD' }} />
            </div>
          </div>
          <div>
            {(() => {
              const pctEro = oreTotali > 0 ? Math.min(Math.round((oreErogate! / oreTotali) * 100), 100) : 0
              return (
                <>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-600">Erogate</span>
                    <span className="font-medium" style={{ color: pctEro > 0 ? '#1D9E75' : '#9ca3af' }}>{pctEro}%</span>
                  </div>
                  <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctEro}%`, backgroundColor: '#1D9E75' }} />
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
