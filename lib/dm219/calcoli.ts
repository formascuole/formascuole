/**
 * Motore di calcolo per il monitoraggio DM 219/2025.
 * Nessuna dipendenza da Supabase — funziona anche in test Node.js puri.
 */

// ── Parametri globali (default) ────────────────────────────────────────────
export const DEFAULT_PARAMS: Dm219Params = {
  ucs_formatore:    122,       // €/ora PF e Lab
  ucs_tutor:        34,        // €/ora solo PF
  quota_indiretti:  0.40,
  soglia_minima:    0.70,
  quota_min_lab:    0.50,
  tutor_riconosciuto: true,
  base_quota_lab:   'realizzato',
}

export interface Dm219Params {
  ucs_formatore:      number
  ucs_tutor:          number
  quota_indiretti:    number
  soglia_minima:      number
  quota_min_lab:      number
  tutor_riconosciuto: boolean
  base_quota_lab:     'realizzato' | 'accordato'
}

// ── Tipi di input ──────────────────────────────────────────────────────────
export type TipoCorso = 'PF' | 'Lab' | 'MF' | 'PF+Lab'

export interface CorsoInput {
  id:              string
  tipo:            TipoCorso
  ore_totali:      number
  ore_erogate:     number         // sessioni completata=true
  ore_pianificate: number         // sessioni future (non erogate)
  formatore_id:    string | null
  corso_completato: boolean
  sessioni_scadute_non_erogate: number  // sessioni passate non erogate
}

// ── Tipi di output ─────────────────────────────────────────────────────────
export type StatoCorso = 'Da avviare' | 'Avviato' | 'Concluso'
export type SemaforoStato = 'VERDE' | 'GIALLO' | 'ARANCIONE' | 'ROSSO'

export interface CorsoCalcolato extends CorsoInput {
  stato:                StatoCorso
  ore_residue:          number
  valore_ora:           number    // €/ora per questo tipo di corso
  valore_previsto:      number
  valore_erogato:       number
  valore_residuo:       number
  obbligatorio:         boolean   // avviato o concluso → entra sempre nello scenario
  nello_scenario:       boolean   // incluso nello scenario minimo
  forzato_incluso:      boolean
  forzato_escluso:      boolean
  segnalazioni:         string[]
}

export interface AggregatiTipo {
  ore_previste:   number
  ore_erogate:    number
  ore_residue:    number
  valore_previsto: number
  valore_erogato:  number
  valore_residuo:  number
  n_conclusi:     number
  n_avviati:      number
  n_da_avviare:   number
}

export interface ScenarioMinimo {
  corsi_inclusi:          string[]    // ids
  corsi_esclusi:          string[]    // ids
  ore_totali:             number
  valore_totale:          number
  quota_lab_pct:          number      // 0–1
  ore_completamento_pf:   number      // ore ancora da erogare su corsi avviati PF
  ore_completamento_lab:  number      // idem Lab
  ore_nuovi_pf:           number      // ore da corsi nuovi PF inclusi
  ore_nuovi_lab:          number      // idem Lab
  ore_rinunciabili:       number      // ore totali - soglia_ore
  valido:                 boolean
  motivo_non_valido?:     string      // quale verifica fallisce
}

export interface VerificaRisultato {
  label:    string
  soglia:   number | string
  valore:   number | string
  ok:       boolean
}

export interface RisultatoProgetto {
  params:               Dm219Params
  finanziamento_accordato: number    // valore ricostruito (valore_previsto totale)
  pf:                   AggregatiTipo
  lab:                  AggregatiTipo
  totale:               AggregatiTipo
  soglia_ore:           number       // ceil(soglia_minima × ore_previste)
  soglia_valore:        number
  scenario:             ScenarioMinimo
  semaforo:             SemaforoStato
  corsi:                CorsoCalcolato[]
  verifiche:            VerificaRisultato[]
  n_segnalazioni:       number
  pct_ore_erogate:      number       // 0–1
  pct_valore_erogato:   number       // 0–1
  ore_mancanti_pf:      number       // al minimo scenario
  ore_mancanti_lab:     number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isPF(tipo: TipoCorso): boolean {
  return tipo === 'PF' || tipo === 'PF+Lab'
}

function isLab(tipo: TipoCorso): boolean {
  return tipo === 'Lab' || tipo === 'PF+Lab'
}

function valoreOra(tipo: TipoCorso, params: Dm219Params): number {
  if (isPF(tipo) && !isLab(tipo)) {
    // Puro PF
    const ucs = params.ucs_formatore + (params.tutor_riconosciuto ? params.ucs_tutor : 0)
    return round2(ucs * (1 + params.quota_indiretti))
  }
  if (isLab(tipo) && !isPF(tipo)) {
    // Puro Lab (nessun tutor)
    return round2(params.ucs_formatore * (1 + params.quota_indiretti))
  }
  // PF+Lab: usiamo valore PF (conservativo)
  const ucs = params.ucs_formatore + (params.tutor_riconosciuto ? params.ucs_tutor : 0)
  return round2(ucs * (1 + params.quota_indiretti))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function ceilOre(n: number): number {
  return Math.ceil(n)
}

function aggrega(corsi: CorsoCalcolato[], filterFn: (c: CorsoCalcolato) => boolean): AggregatiTipo {
  const filtered = corsi.filter(filterFn)
  return {
    ore_previste:    filtered.reduce((a, c) => a + c.ore_totali, 0),
    ore_erogate:     filtered.reduce((a, c) => a + c.ore_erogate, 0),
    ore_residue:     filtered.reduce((a, c) => a + c.ore_residue, 0),
    valore_previsto: round2(filtered.reduce((a, c) => a + c.valore_previsto, 0)),
    valore_erogato:  round2(filtered.reduce((a, c) => a + c.valore_erogato, 0)),
    valore_residuo:  round2(filtered.reduce((a, c) => a + c.valore_residuo, 0)),
    n_conclusi:      filtered.filter(c => c.stato === 'Concluso').length,
    n_avviati:       filtered.filter(c => c.stato === 'Avviato').length,
    n_da_avviare:    filtered.filter(c => c.stato === 'Da avviare').length,
  }
}

// ── Scenario minimo ────────────────────────────────────────────────────────

function calcolaScenario(
  corsi: CorsoCalcolato[],
  soglia_ore: number,
  soglia_valore: number,
  quota_min_lab: number,
  finanziamento_accordato: number,
  base_quota_lab: 'realizzato' | 'accordato',
  corsi_forzati_inclusi: string[],
  corsi_forzati_esclusi: string[],
): ScenarioMinimo {

  // Corsi obbligatori: avviati + conclusi (regola a) + forzati inclusi
  const obbligatori = corsi.filter(c =>
    (c.obbligatorio && !corsi_forzati_esclusi.includes(c.id)) ||
    corsi_forzati_inclusi.includes(c.id)
  )

  // Corsi opzionali: da avviare, non forzati esclusi, non già obbligatori
  const opzionali = corsi.filter(c =>
    c.stato === 'Da avviare' &&
    !corsi_forzati_inclusi.includes(c.id) &&
    !corsi_forzati_esclusi.includes(c.id)
  )

  function valutaCombo(inclusi: CorsoCalcolato[]): {
    ore: number; valore: number; valore_lab: number
    ore_pf: number; ore_lab: number
  } {
    const tutti = [...obbligatori, ...inclusi]
    const ore = tutti.reduce((a, c) => a + c.ore_totali, 0)
    const valore = round2(tutti.reduce((a, c) => a + c.valore_previsto, 0))
    const valore_lab = round2(
      tutti.filter(c => isLab(c.tipo)).reduce((a, c) => a + c.valore_previsto, 0)
    )
    const ore_pf = tutti.filter(c => isPF(c.tipo) && !isLab(c.tipo)).reduce((a, c) => a + c.ore_totali, 0)
    const ore_lab = tutti.filter(c => isLab(c.tipo)).reduce((a, c) => a + c.ore_totali, 0)
    return { ore, valore, valore_lab, ore_pf, ore_lab }
  }

  function isValida(combo: { ore: number; valore: number; valore_lab: number }): boolean {
    if (combo.ore < soglia_ore) return false
    if (combo.valore < soglia_valore) return false
    const base = base_quota_lab === 'accordato' ? finanziamento_accordato : combo.valore
    if (base > 0 && combo.valore_lab / base < quota_min_lab) return false
    return true
  }

  // Prova tutte le combinazioni dei corsi opzionali (ricerca esaustiva)
  let bestInclusi: CorsoCalcolato[] | null = null
  let bestOre = Infinity

  const n = opzionali.length
  for (let mask = 0; mask < (1 << n); mask++) {
    const combo: CorsoCalcolato[] = []
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) combo.push(opzionali[i])
    }
    const valutazione = valutaCombo(combo)
    if (isValida(valutazione)) {
      // Criterio: meno ore totali; a parità non gestiamo la data (non abbiamo data_fine qui)
      if (valutazione.ore < bestOre) {
        bestOre = valutazione.ore
        bestInclusi = combo
      }
    }
  }

  if (bestInclusi === null) {
    // Nessuna combinazione valida — trova il motivo
    const tuttiCombo = valutaCombo(opzionali)
    let motivo = ''
    if (tuttiCombo.ore < soglia_ore) motivo = `Ore insufficienti anche con tutti i corsi (${tuttiCombo.ore} < ${soglia_ore})`
    else if (tuttiCombo.valore < soglia_valore) motivo = `Valore insufficiente anche con tutti i corsi (${round2(tuttiCombo.valore)} < ${round2(soglia_valore)} €)`
    else {
      const base = base_quota_lab === 'accordato' ? finanziamento_accordato : tuttiCombo.valore
      motivo = `Quota Lab insufficiente anche con tutti i corsi (${round2(tuttiCombo.valore_lab / base * 100)}% < ${quota_min_lab * 100}%)`
    }
    const val = valutaCombo([])
    return {
      corsi_inclusi: obbligatori.map(c => c.id),
      corsi_esclusi: opzionali.map(c => c.id),
      ore_totali: val.ore,
      valore_totale: val.valore,
      quota_lab_pct: val.valore > 0 ? round2(val.valore_lab / val.valore) : 0,
      ore_completamento_pf: 0,
      ore_completamento_lab: 0,
      ore_nuovi_pf: 0,
      ore_nuovi_lab: 0,
      ore_rinunciabili: 0,
      valido: false,
      motivo_non_valido: motivo,
    }
  }

  const inclusiFinali = [...obbligatori, ...bestInclusi]
  const val = valutaCombo(bestInclusi)

  // Calcola ore ancora da erogare
  const ore_completamento_pf = obbligatori
    .filter(c => isPF(c.tipo) && !isLab(c.tipo) && c.stato === 'Avviato')
    .reduce((a, c) => a + (c.ore_totali - c.ore_erogate), 0)
  const ore_completamento_lab = obbligatori
    .filter(c => isLab(c.tipo) && c.stato === 'Avviato')
    .reduce((a, c) => a + (c.ore_totali - c.ore_erogate), 0)
  const ore_nuovi_pf = bestInclusi
    .filter(c => isPF(c.tipo) && !isLab(c.tipo))
    .reduce((a, c) => a + c.ore_totali, 0)
  const ore_nuovi_lab = bestInclusi
    .filter(c => isLab(c.tipo))
    .reduce((a, c) => a + c.ore_totali, 0)

  const base = base_quota_lab === 'accordato' ? finanziamento_accordato : val.valore
  const quota_lab_pct = base > 0 ? round2(
    round2(inclusiFinali.filter(c => isLab(c.tipo)).reduce((a, c) => a + c.valore_previsto, 0)) / base
  ) : 0

  return {
    corsi_inclusi: inclusiFinali.map(c => c.id),
    corsi_esclusi: opzionali.filter(c => !bestInclusi!.includes(c)).map(c => c.id),
    ore_totali: val.ore,
    valore_totale: val.valore,
    quota_lab_pct,
    ore_completamento_pf,
    ore_completamento_lab,
    ore_nuovi_pf,
    ore_nuovi_lab,
    ore_rinunciabili: Math.max(0, val.ore - soglia_ore),
    valido: true,
  }
}

// ── Entry point principale ─────────────────────────────────────────────────

export function calcolaProgettoDm219(
  corsiInput: CorsoInput[],
  paramsOverride: Partial<Dm219Params> = {},
  corsi_forzati_inclusi: string[] = [],
  corsi_forzati_esclusi: string[] = [],
): RisultatoProgetto {
  const params: Dm219Params = { ...DEFAULT_PARAMS, ...paramsOverride }
  const oggi = new Date().toISOString().slice(0, 10)
  void oggi // usato implicitamente: le sessioni scadute_non_erogate vengono passate dall'esterno

  // 1. Calcola ogni corso
  const corsi: CorsoCalcolato[] = corsiInput.map(c => {
    const stato: StatoCorso =
      c.ore_erogate === 0 ? 'Da avviare'
      : c.ore_erogate >= c.ore_totali || c.corso_completato ? 'Concluso'
      : 'Avviato'

    const valore_ora  = valoreOra(c.tipo, params)
    const ore_residue = Math.max(0, c.ore_totali - c.ore_erogate)
    const segnalazioni: string[] = []
    if (!c.formatore_id) segnalazioni.push('Formatore non assegnato')
    if (c.sessioni_scadute_non_erogate > 0)
      segnalazioni.push(`${c.sessioni_scadute_non_erogate} session${c.sessioni_scadute_non_erogate > 1 ? 'i' : 'e'} scadut${c.sessioni_scadute_non_erogate > 1 ? 'e' : 'a'} non erogata`)

    const obbligatorio = stato === 'Avviato' || stato === 'Concluso'

    return {
      ...c,
      stato,
      ore_residue,
      valore_ora,
      valore_previsto: round2(c.ore_totali * valore_ora),
      valore_erogato:  round2(c.ore_erogate * valore_ora),
      valore_residuo:  round2(ore_residue * valore_ora),
      obbligatorio,
      nello_scenario:  false, // verrà aggiornato dopo
      forzato_incluso: corsi_forzati_inclusi.includes(c.id),
      forzato_escluso: corsi_forzati_esclusi.includes(c.id),
      segnalazioni,
    }
  })

  // 2. Aggregati per tipo
  const pf  = aggrega(corsi, c => isPF(c.tipo) && !isLab(c.tipo))
  const lab = aggrega(corsi, c => isLab(c.tipo) && !isPF(c.tipo))
  // PF+Lab: conteggiato in entrambi se presente, ma nei totali una volta sola
  const totale = aggrega(corsi, () => true)

  // 3. Finanziamento accordato = valore previsto totale (ricostruito)
  const finanziamento_accordato = totale.valore_previsto

  // 4. Soglie
  const soglia_ore   = ceilOre(params.soglia_minima * totale.ore_previste)
  const soglia_valore = round2(params.soglia_minima * finanziamento_accordato)

  // 5. Scenario minimo
  const scenario = calcolaScenario(
    corsi, soglia_ore, soglia_valore,
    params.quota_min_lab, finanziamento_accordato,
    params.base_quota_lab,
    corsi_forzati_inclusi, corsi_forzati_esclusi,
  )

  // 6. Aggiorna flag nello_scenario
  const scenarioSet = new Set(scenario.corsi_inclusi)
  corsi.forEach(c => { c.nello_scenario = scenarioSet.has(c.id) })

  // 7. Verifiche
  const pct_ore    = totale.ore_previste > 0 ? totale.ore_erogate / totale.ore_previste : 0
  const pct_valore = finanziamento_accordato > 0 ? totale.valore_erogato / finanziamento_accordato : 0
  const valore_lab_erogato = round2(corsi.filter(c => isLab(c.tipo)).reduce((a, c) => a + c.valore_erogato, 0))
  const base_lab = params.base_quota_lab === 'accordato'
    ? finanziamento_accordato
    : totale.valore_erogato

  const verifiche: VerificaRisultato[] = [
    {
      label:  'Ore erogate ≥ 70%',
      soglia: `${ceilOre(params.soglia_minima * totale.ore_previste)} ore`,
      valore: `${totale.ore_erogate} ore (${Math.round(pct_ore * 100)}%)`,
      ok: totale.ore_erogate >= soglia_ore,
    },
    {
      label:  'Valore erogato ≥ 70%',
      soglia: `${soglia_valore.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}`,
      valore: `${totale.valore_erogato.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} (${Math.round(pct_valore * 100)}%)`,
      ok: totale.valore_erogato >= soglia_valore,
    },
    {
      label:  'Quota Lab ≥ 50%',
      soglia: `50% del ${params.base_quota_lab === 'accordato' ? 'finanziamento' : 'realizzato'}`,
      valore: base_lab > 0
        ? `${Math.round(valore_lab_erogato / base_lab * 100)}%`
        : '—',
      ok: base_lab > 0 && valore_lab_erogato / base_lab >= params.quota_min_lab,
    },
    {
      label:  'Corsi avviati portati a termine',
      soglia: 'Tutti i corsi avviati conclusi',
      valore: corsi.filter(c => c.stato === 'Avviato').length === 0
        ? 'Nessun corso in corso'
        : `${corsi.filter(c => c.stato === 'Avviato').length} corsi ancora in corso`,
      ok: corsi.filter(c => c.stato === 'Avviato').length === 0,
    },
  ]

  // 8. Semaforo
  const tutteLeVerifiche = verifiche.every(v => v.ok)
  const oreErogateEPianificate = totale.ore_erogate + totale.ore_pianificate // non è un campo ma lo calcoliamo
  void oreErogateEPianificate

  // Ore totali erogate+pianificate per corsi dello scenario
  const oreScenarioCorsiErogatiEPianificati = corsi
    .filter(c => c.nello_scenario)
    .reduce((a, c) => a + c.ore_erogate + c.ore_pianificate, 0)
  const oreScenarioNecessarie = scenario.ore_totali
  const scenarioCoperto = oreScenarioCorsiErogatiEPianificati >= oreScenarioNecessarie

  const hasSegnalazioniNelloScenario = corsi
    .filter(c => c.nello_scenario)
    .some(c => c.segnalazioni.length > 0)

  let semaforo: SemaforoStato
  if (!scenario.valido) {
    semaforo = 'ROSSO'
  } else if (tutteLeVerifiche) {
    semaforo = 'VERDE'
  } else if (scenarioCoperto && !hasSegnalazioniNelloScenario) {
    semaforo = 'GIALLO'
  } else {
    semaforo = 'ARANCIONE'
  }

  // 9. Ore mancanti al minimo scenario
  const ore_scenario_pf  = corsi.filter(c => c.nello_scenario && isPF(c.tipo) && !isLab(c.tipo)).reduce((a, c) => a + c.ore_totali, 0)
  const ore_erogate_pf   = corsi.filter(c => c.nello_scenario && isPF(c.tipo) && !isLab(c.tipo)).reduce((a, c) => a + c.ore_erogate, 0)
  const ore_scenario_lab = corsi.filter(c => c.nello_scenario && isLab(c.tipo)).reduce((a, c) => a + c.ore_totali, 0)
  const ore_erogate_lab  = corsi.filter(c => c.nello_scenario && isLab(c.tipo)).reduce((a, c) => a + c.ore_erogate, 0)

  return {
    params,
    finanziamento_accordato,
    pf,
    lab,
    totale,
    soglia_ore,
    soglia_valore,
    scenario,
    semaforo,
    corsi,
    verifiche,
    n_segnalazioni: corsi.reduce((a, c) => a + c.segnalazioni.length, 0),
    pct_ore_erogate: round2(pct_ore),
    pct_valore_erogato: round2(pct_valore),
    ore_mancanti_pf:  Math.max(0, ore_scenario_pf  - ore_erogate_pf),
    ore_mancanti_lab: Math.max(0, ore_scenario_lab - ore_erogate_lab),
  }
}
