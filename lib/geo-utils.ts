export const PROVINCE_TO_REGION: Record<string, string> = {
  // Abruzzo
  AQ: 'Abruzzo', CH: 'Abruzzo', PE: 'Abruzzo', TE: 'Abruzzo',
  // Basilicata
  MT: 'Basilicata', PZ: 'Basilicata',
  // Calabria
  CZ: 'Calabria', KR: 'Calabria', RC: 'Calabria', CS: 'Calabria', VV: 'Calabria',
  // Campania
  AV: 'Campania', BN: 'Campania', CE: 'Campania', NA: 'Campania', SA: 'Campania',
  // Emilia-Romagna
  BO: 'Emilia-Romagna', FC: 'Emilia-Romagna', FE: 'Emilia-Romagna', MO: 'Emilia-Romagna',
  PR: 'Emilia-Romagna', PC: 'Emilia-Romagna', RA: 'Emilia-Romagna', RE: 'Emilia-Romagna', RN: 'Emilia-Romagna',
  // Friuli-Venezia Giulia
  GO: 'Friuli-Venezia Giulia', PN: 'Friuli-Venezia Giulia', TS: 'Friuli-Venezia Giulia', UD: 'Friuli-Venezia Giulia',
  // Lazio
  FR: 'Lazio', LT: 'Lazio', RI: 'Lazio', RM: 'Lazio', VT: 'Lazio',
  // Liguria
  GE: 'Liguria', IM: 'Liguria', SP: 'Liguria', SV: 'Liguria',
  // Lombardia
  BG: 'Lombardia', BS: 'Lombardia', CO: 'Lombardia', CR: 'Lombardia', LC: 'Lombardia',
  LO: 'Lombardia', MB: 'Lombardia', MI: 'Lombardia', MN: 'Lombardia', PV: 'Lombardia', SO: 'Lombardia', VA: 'Lombardia',
  // Marche
  AN: 'Marche', AP: 'Marche', FM: 'Marche', MC: 'Marche', PU: 'Marche',
  // Molise
  CB: 'Molise', IS: 'Molise',
  // Piemonte
  AL: 'Piemonte', AT: 'Piemonte', BI: 'Piemonte', CN: 'Piemonte', NO: 'Piemonte',
  TO: 'Piemonte', VB: 'Piemonte', VC: 'Piemonte',
  // Puglia
  BA: 'Puglia', BAT: 'Puglia', BR: 'Puglia', FG: 'Puglia', LE: 'Puglia', TA: 'Puglia',
  // Sardegna
  CA: 'Sardegna', CI: 'Sardegna', MD: 'Sardegna', NU: 'Sardegna', OG: 'Sardegna',
  OR: 'Sardegna', OT: 'Sardegna', SS: 'Sardegna', VS: 'Sardegna',
  // Sicilia
  AG: 'Sicilia', CL: 'Sicilia', CT: 'Sicilia', EN: 'Sicilia', ME: 'Sicilia',
  PA: 'Sicilia', RG: 'Sicilia', SR: 'Sicilia', TP: 'Sicilia',
  // Toscana
  AR: 'Toscana', FI: 'Toscana', GR: 'Toscana', LI: 'Toscana', LU: 'Toscana',
  MS: 'Toscana', PI: 'Toscana', PO: 'Toscana', PT: 'Toscana', SI: 'Toscana',
  // Trentino-Alto Adige
  BZ: 'Trentino-Alto Adige', TN: 'Trentino-Alto Adige',
  // Umbria
  PG: 'Umbria', TR: 'Umbria',
  // Valle d'Aosta
  AO: "Valle d'Aosta",
  // Veneto
  BL: 'Veneto', PD: 'Veneto', RO: 'Veneto', TV: 'Veneto', VE: 'Veneto', VI: 'Veneto', VR: 'Veneto',
}

/** Try to extract a 2-letter province code from an Italian address string. */
export function extractProvincia(address: string | null | undefined): string | null {
  if (!address) return null
  // "(RM)" or "(BAT)" pattern
  const m = address.match(/\(([A-Za-z]{2,3})\)/)
  if (m) return m[1].toUpperCase()
  // "- RM" or ", RM" at end of string
  const m2 = address.match(/[-,]\s*([A-Za-z]{2})\s*$/)
  if (m2) return m2[1].toUpperCase()
  return null
}

export function getRegione(provincia: string | null | undefined): string | null {
  if (!provincia) return null
  return PROVINCE_TO_REGION[provincia.toUpperCase()] ?? null
}

/** Get the regione for a formatore profile, preferring the explicit regione field. */
export function getRegioneFormatore(profile: {
  regione?: string | null
  indirizzo_provincia?: string | null
}): string | null {
  if (profile.regione) return profile.regione
  if (profile.indirizzo_provincia) return getRegione(profile.indirizzo_provincia)
  return null
}

/** Get the regione for a progetto, preferring the explicit regione field. */
export function getRegioneProgetto(progetto: {
  regione?: string | null
  address?: string | null
}): string | null {
  if (progetto.regione) return progetto.regione
  if (progetto.address) {
    const prov = extractProvincia(progetto.address)
    if (prov) return getRegione(prov)
  }
  return null
}
