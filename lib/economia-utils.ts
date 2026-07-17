export type RegimeFiscale = 'forfettario' | 'ordinario' | 'notula'

export interface Financials {
  imponibile: number
  ritenuteIva: number  // backward compat: ritenuta + iva (negative ritenuta + positive iva)
  netto: number
  ritenuta: number     // -20% if notula (always negative or zero)
  iva: number          // +22% if ordinario+rivalsa (always positive or zero)
  inps: number         // +4% if P.IVA+inps_gs (always positive or zero)
}

export function calcFinancials(
  ore: number,
  tariffa: number,
  regime: RegimeFiscale,
  rivalsa: boolean,
  inps_gestione_separata = false,
  ha_partita_iva = false,
): Financials {
  const imponibile = ore * tariffa
  const ritenuta = regime === 'notula' ? -(imponibile * 0.2) : 0
  const iva = (regime === 'ordinario' && rivalsa) ? imponibile * 0.22 : 0
  const inps = (ha_partita_iva && inps_gestione_separata) ? imponibile * 0.04 : 0
  const netto = imponibile + ritenuta + iva + inps
  return { imponibile, ritenuta, iva, inps, ritenuteIva: ritenuta + iva, netto }
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

export function calcCommissionePartner(fatturato: number): { totale_ivato: number; imponibile: number; iva: number } {
  const totale_ivato = fatturato <= 100000
    ? fatturato * 0.10
    : 10000 + (fatturato - 100000) * 0.12
  const imponibile = totale_ivato / 1.22
  const iva = totale_ivato - imponibile
  return { totale_ivato, imponibile, iva }
}
