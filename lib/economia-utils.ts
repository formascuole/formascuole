export type RegimeFiscale = 'forfettario' | 'ordinario' | 'notula'

export interface Financials {
  imponibile: number
  ritenuteIva: number  // negative = ritenuta deducted; positive = IVA added
  netto: number
}

export function calcFinancials(ore: number, tariffa: number, regime: RegimeFiscale, rivalsa: boolean): Financials {
  const imponibile = ore * tariffa
  if (regime === 'notula') {
    const r = imponibile * 0.2
    return { imponibile, ritenuteIva: -r, netto: imponibile - r }
  }
  if (regime === 'ordinario' && rivalsa) {
    const iva = imponibile * 0.22
    return { imponibile, ritenuteIva: iva, netto: imponibile + iva }
  }
  return { imponibile, ritenuteIva: 0, netto: imponibile }
}

export function fmtCur(n: number): string {
  return `€ ${n.toFixed(2)}`
}

export const REGIME_LABELS: Record<RegimeFiscale, string> = {
  forfettario: 'Forfettario',
  ordinario:   'Ordinario',
  notula:      'Prestazione occ.',
}

export const REGIME_BADGE: Record<RegimeFiscale, string> = {
  forfettario: 'bg-green-100 text-green-700',
  ordinario:   'bg-blue-100 text-blue-700',
  notula:      'bg-orange-100 text-orange-700',
}
