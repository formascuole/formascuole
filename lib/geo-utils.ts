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

// Coordinates of all 107 Italian province capitals — fallback when Nominatim fails.
export const PROVINCE_COORDS: Record<string, [number, number]> = {
  AG: [37.3220, 13.5794], AL: [44.9133, 8.6158],  AN: [43.6158, 13.5189], AO: [45.7371, 7.3196],
  AP: [42.8506, 13.5748], AQ: [42.3508, 13.3995],  AR: [43.4633, 11.8789], AT: [44.8987, 8.2065],
  AV: [40.9140, 14.7895], BA: [41.1171, 16.8719],  BG: [45.6983, 9.6773],  BI: [45.5628, 8.0584],
  BL: [46.1405, 12.2161], BN: [41.1297, 14.7680],  BO: [44.4949, 11.3426], BR: [40.6328, 17.9410],
  BS: [45.5417, 10.2118], BT: [41.3158, 16.2851],  BZ: [46.4983, 11.3548], CA: [39.2238, 9.1217],
  CB: [41.5597, 14.6659], CE: [41.0720, 14.3326],  CH: [42.3518, 14.1683], CL: [37.4897, 13.9906],
  CN: [44.3918, 7.5486],  CO: [45.8083, 9.0852],   CR: [45.1333, 10.0233], CS: [39.3042, 16.2525],
  CT: [37.5079, 15.0830], CZ: [38.9100, 16.5887],  EN: [37.5660, 14.2782], FC: [44.2227, 12.0407],
  FE: [44.8381, 11.6198], FG: [41.4621, 15.5444],  FI: [43.7696, 11.2558], FM: [43.1546, 13.7211],
  FR: [41.6376, 13.3473], GE: [44.4056, 8.9463],   GO: [45.9413, 13.6218], GR: [42.7636, 11.1131],
  IM: [43.8914, 8.0303],  IS: [41.5948, 14.2299],  KR: [39.0907, 17.1282], LC: [45.8565, 9.3975],
  LE: [40.3539, 18.1750], LI: [43.5528, 10.3115],  LO: [45.3100, 9.5033],  LT: [41.4638, 12.9043],
  LU: [43.8430, 10.5079], MB: [45.5845, 9.2745],   MC: [43.3022, 13.4534], ME: [38.1938, 15.5542],
  MI: [45.4654, 9.1866],  MN: [45.1564, 10.7914],  MO: [44.6469, 10.9252], MS: [44.0353, 9.9797],
  MT: [40.6663, 16.6049], NA: [40.8518, 14.2681],  NO: [45.4451, 8.6217],  NU: [40.3198, 9.3267],
  OR: [39.9036, 8.5925],  PA: [38.1157, 13.3615],  PC: [44.9967, 9.7077],  PD: [45.4064, 11.8768],
  PE: [42.4618, 14.2168], PG: [43.1107, 12.3908],  PI: [43.7228, 10.4017], PN: [46.0636, 12.6636],
  PO: [43.8795, 11.1021], PR: [44.8015, 10.3279],  PT: [43.9294, 10.9054], PU: [43.9100, 12.9136],
  PV: [45.1847, 9.1582],  PZ: [40.6355, 15.8058],  RA: [44.4184, 12.2035], RC: [38.1147, 15.6500],
  RE: [44.6978, 10.6313], RG: [36.9255, 14.7252],  RI: [42.4045, 12.8628], RM: [41.9028, 12.4964],
  RN: [44.0595, 12.5683], RO: [45.0705, 11.7900],  SA: [40.6826, 14.7681], SI: [43.3186, 11.3307],
  SO: [46.1697, 9.8716],  SP: [44.1023, 9.8236],   SR: [37.0755, 15.2866], SS: [40.7259, 8.5553],
  SU: [39.1671, 8.5232],  SV: [44.3048, 8.4825],   TA: [40.4638, 17.2470], TE: [42.6589, 13.6996],
  TN: [46.0748, 11.1217], TO: [45.0703, 7.6869],   TP: [37.9981, 12.5431], TR: [42.5637, 12.6430],
  TS: [45.6495, 13.7768], TV: [45.6669, 12.2439],  UD: [46.0642, 13.2344], VA: [45.8206, 8.8257],
  VB: [45.9219, 8.5504],  VC: [45.3294, 8.4244],   VE: [45.4408, 12.3155], VI: [45.5477, 11.5476],
  VR: [45.4387, 10.9916], VT: [42.4176, 12.1075],  VV: [38.6746, 16.1034],
}

export const REGIONE_COORDS: Record<string, [number, number]> = {
  'Abruzzo':                [42.3510, 13.3990],
  'Basilicata':             [40.6396, 15.8060],
  'Calabria':               [38.9060, 16.5945],
  'Campania':               [40.8333, 14.2500],
  'Emilia-Romagna':         [44.4949, 11.3426],
  'Friuli-Venezia Giulia':  [45.6495, 13.7768],
  'Lazio':                  [41.9028, 12.4964],
  'Liguria':                [44.4056, 8.9463],
  'Lombardia':              [45.4654, 9.1866],
  'Marche':                 [43.6158, 13.5189],
  'Molise':                 [41.5597, 14.6659],
  'Piemonte':               [45.0703, 7.6869],
  'Puglia':                 [41.1171, 16.8719],
  'Sardegna':               [39.2238, 9.1217],
  'Sicilia':                [38.1157, 13.3615],
  'Toscana':                [43.7696, 11.2558],
  'Trentino-Alto Adige':    [46.0748, 11.1217],
  'Umbria':                 [43.1107, 12.3908],
  "Valle d'Aosta":          [45.7371, 7.3196],
  'Veneto':                 [45.4408, 12.3155],
}
