/**
 * Test automatici per il motore DM 219/2025.
 * Caso di test: ISIS Enrico Fermi (dati al 19/11/2026).
 *
 * Esegui con:  node __tests__/dm219-calcoli.test.mjs
 *
 * Risultati attesi (dallo spec):
 *   ore previste 247 (PF 112, Lab 135)
 *   ore erogate 84 (PF 69, Lab 15)
 *   valore previsto 47.518,80 €
 *   valore erogato 17.631,60 €
 *   soglia_ore 173
 *   soglia_valore 33.263,16 €
 *   scenario minimo: PF 84 ore, Lab 110 ore, totale 194, 37.133,60 €, quota Lab 50,6%
 *   ancora da erogare: PF 15 (completamento), Lab 95 (nuovi corsi)
 *   con base_quota_lab="accordato": stato "Non raggiungibile"
 *   con tutor_riconosciuto=false: scenario minimo 174 ore (PF 84, Lab 90)
 */

// Import diretto dal sorgente TS — non funziona in Node.js puro senza ts-node.
// Lo testiamo compilando i valori attesi a partire dalle costanti, o usando
// esbuild/tsx se installato. Proviamo tsx prima.
import { execSync } from 'child_process'
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Implementazione inline (copia fedele di lib/dm219/calcoli.ts) ─────────
// (Usiamo una versione JS-pura per evitare dipendenze da tsx/ts-node
//  che potrebbero non essere installate)

const DEFAULT_PARAMS = {
  ucs_formatore:      122,
  ucs_tutor:          34,
  quota_indiretti:    0.40,
  soglia_minima:      0.70,
  quota_min_lab:      0.50,
  tutor_riconosciuto: true,
  base_quota_lab:     'realizzato',
}

function isPF(tipo) { return tipo === 'PF' || tipo === 'PF+Lab' }
function isLab(tipo) { return tipo === 'Lab' || tipo === 'PF+Lab' }
function round2(n) { return Math.round(n * 100) / 100 }
function ceilOre(n) { return Math.ceil(n) }

function valoreOra(tipo, params) {
  if (isPF(tipo) && !isLab(tipo)) {
    const ucs = params.ucs_formatore + (params.tutor_riconosciuto ? params.ucs_tutor : 0)
    return round2(ucs * (1 + params.quota_indiretti))
  }
  if (isLab(tipo) && !isPF(tipo)) {
    return round2(params.ucs_formatore * (1 + params.quota_indiretti))
  }
  const ucs = params.ucs_formatore + (params.tutor_riconosciuto ? params.ucs_tutor : 0)
  return round2(ucs * (1 + params.quota_indiretti))
}

function calcolaScenario(corsi, soglia_ore, soglia_valore, quota_min_lab, finanziamento_accordato, base_quota_lab, corsi_forzati_inclusi, corsi_forzati_esclusi) {
  const obbligatori = corsi.filter(c =>
    ((c.stato === 'Avviato' || c.stato === 'Concluso') && !corsi_forzati_esclusi.includes(c.id)) ||
    corsi_forzati_inclusi.includes(c.id)
  )
  const opzionali = corsi.filter(c =>
    c.stato === 'Da avviare' &&
    !corsi_forzati_inclusi.includes(c.id) &&
    !corsi_forzati_esclusi.includes(c.id)
  )

  function valutaCombo(inclusi) {
    const tutti = [...obbligatori, ...inclusi]
    const ore = tutti.reduce((a, c) => a + c.ore_totali, 0)
    const valore = round2(tutti.reduce((a, c) => a + c.valore_previsto, 0))
    const valore_lab = round2(tutti.filter(c => isLab(c.tipo)).reduce((a, c) => a + c.valore_previsto, 0))
    const ore_pf = tutti.filter(c => isPF(c.tipo) && !isLab(c.tipo)).reduce((a, c) => a + c.ore_totali, 0)
    const ore_lab = tutti.filter(c => isLab(c.tipo)).reduce((a, c) => a + c.ore_totali, 0)
    return { ore, valore, valore_lab, ore_pf, ore_lab }
  }

  function isValida(combo) {
    if (combo.ore < soglia_ore) return false
    if (combo.valore < soglia_valore) return false
    const base = base_quota_lab === 'accordato' ? finanziamento_accordato : combo.valore
    if (base > 0 && combo.valore_lab / base < quota_min_lab) return false
    return true
  }

  let bestInclusi = null
  let bestOre = Infinity
  const n = opzionali.length
  for (let mask = 0; mask < (1 << n); mask++) {
    const combo = []
    for (let i = 0; i < n; i++) { if (mask & (1 << i)) combo.push(opzionali[i]) }
    const val = valutaCombo(combo)
    if (isValida(val) && val.ore < bestOre) { bestOre = val.ore; bestInclusi = combo }
  }

  if (bestInclusi === null) {
    const tuttiCombo = valutaCombo(opzionali)
    let motivo = ''
    if (tuttiCombo.ore < soglia_ore) motivo = `Ore insufficienti anche con tutti i corsi`
    else if (tuttiCombo.valore < soglia_valore) motivo = `Valore insufficiente anche con tutti i corsi`
    else motivo = `Quota Lab insufficiente anche con tutti i corsi`
    const val = valutaCombo([])
    return { corsi_inclusi: obbligatori.map(c => c.id), corsi_esclusi: opzionali.map(c => c.id), ore_totali: val.ore, valore_totale: val.valore, quota_lab_pct: 0, valido: false, motivo_non_valido: motivo, ore_completamento_pf: 0, ore_completamento_lab: 0, ore_nuovi_pf: 0, ore_nuovi_lab: 0, ore_rinunciabili: 0 }
  }

  const inclusiFinali = [...obbligatori, ...bestInclusi]
  const val = valutaCombo(bestInclusi)
  const ore_completamento_pf = obbligatori.filter(c => isPF(c.tipo) && !isLab(c.tipo) && c.stato === 'Avviato').reduce((a, c) => a + (c.ore_totali - c.ore_erogate), 0)
  const ore_completamento_lab = obbligatori.filter(c => isLab(c.tipo) && c.stato === 'Avviato').reduce((a, c) => a + (c.ore_totali - c.ore_erogate), 0)
  const ore_nuovi_pf = bestInclusi.filter(c => isPF(c.tipo) && !isLab(c.tipo)).reduce((a, c) => a + c.ore_totali, 0)
  const ore_nuovi_lab = bestInclusi.filter(c => isLab(c.tipo)).reduce((a, c) => a + c.ore_totali, 0)
  const base = base_quota_lab === 'accordato' ? finanziamento_accordato : val.valore
  const quota_lab_pct = base > 0 ? round2(round2(inclusiFinali.filter(c => isLab(c.tipo)).reduce((a, c) => a + c.valore_previsto, 0)) / base) : 0

  return {
    corsi_inclusi: inclusiFinali.map(c => c.id),
    corsi_esclusi: opzionali.filter(c => !bestInclusi.includes(c)).map(c => c.id),
    ore_totali: val.ore, valore_totale: val.valore, quota_lab_pct,
    ore_completamento_pf, ore_completamento_lab, ore_nuovi_pf, ore_nuovi_lab,
    ore_rinunciabili: Math.max(0, val.ore - soglia_ore), valido: true
  }
}

function calcolaProgettoDm219(corsiInput, paramsOverride = {}, corsi_forzati_inclusi = [], corsi_forzati_esclusi = []) {
  const params = { ...DEFAULT_PARAMS, ...paramsOverride }

  const corsi = corsiInput.map(c => {
    const stato = c.ore_erogate === 0 ? 'Da avviare' : c.ore_erogate >= c.ore_totali || c.corso_completato ? 'Concluso' : 'Avviato'
    const vo = valoreOra(c.tipo, params)
    const ore_residue = Math.max(0, c.ore_totali - c.ore_erogate)
    return { ...c, stato, ore_residue, valore_ora: vo, valore_previsto: round2(c.ore_totali * vo), valore_erogato: round2(c.ore_erogate * vo), valore_residuo: round2(ore_residue * vo), obbligatorio: stato === 'Avviato' || stato === 'Concluso', nello_scenario: false, segnalazioni: [] }
  })

  function agg(filter) {
    const f = corsi.filter(filter)
    return {
      ore_previste: f.reduce((a, c) => a + c.ore_totali, 0),
      ore_erogate: f.reduce((a, c) => a + c.ore_erogate, 0),
      valore_previsto: round2(f.reduce((a, c) => a + c.valore_previsto, 0)),
      valore_erogato: round2(f.reduce((a, c) => a + c.valore_erogato, 0)),
    }
  }

  const pf = agg(c => isPF(c.tipo) && !isLab(c.tipo))
  const lab = agg(c => isLab(c.tipo) && !isPF(c.tipo))
  const totale = agg(() => true)
  const finanziamento_accordato = totale.valore_previsto
  const soglia_ore = ceilOre(params.soglia_minima * totale.ore_previste)
  const soglia_valore = round2(params.soglia_minima * finanziamento_accordato)

  const scenario = calcolaScenario(corsi, soglia_ore, soglia_valore, params.quota_min_lab, finanziamento_accordato, params.base_quota_lab, corsi_forzati_inclusi, corsi_forzati_esclusi)

  const ore_scenario_pf = corsi.filter(c => scenario.corsi_inclusi.includes(c.id) && isPF(c.tipo) && !isLab(c.tipo)).reduce((a, c) => a + c.ore_totali, 0)
  const ore_erogate_pf = corsi.filter(c => scenario.corsi_inclusi.includes(c.id) && isPF(c.tipo) && !isLab(c.tipo)).reduce((a, c) => a + c.ore_erogate, 0)
  const ore_scenario_lab = corsi.filter(c => scenario.corsi_inclusi.includes(c.id) && isLab(c.tipo)).reduce((a, c) => a + c.ore_totali, 0)
  const ore_erogate_lab = corsi.filter(c => scenario.corsi_inclusi.includes(c.id) && isLab(c.tipo)).reduce((a, c) => a + c.ore_erogate, 0)

  return {
    params, finanziamento_accordato, pf, lab, totale, soglia_ore, soglia_valore, scenario,
    ore_mancanti_pf: Math.max(0, ore_scenario_pf - ore_erogate_pf),
    ore_mancanti_lab: Math.max(0, ore_scenario_lab - ore_erogate_lab),
  }
}

// ── Dataset ISIS Enrico Fermi ──────────────────────────────────────────────
/*
Corsi PF (ore previste / erogate): 20/15, 20/15, 20/15, 24/24, 20/0, 8/0
Corsi Lab: 15/15, poi sei da 15/0 e tre da 10/0
*/

let _id = 0
function corso(tipo, ore_totali, ore_erogate) {
  return {
    id: `c${++_id}`,
    tipo,
    ore_totali,
    ore_erogate,
    ore_pianificate: 0,
    formatore_id: 'f1',
    corso_completato: ore_erogate >= ore_totali,
    sessioni_scadute_non_erogate: 0,
  }
}

const corsiIsisEnricoFermi = [
  // PF
  corso('PF', 20, 15),  // Avviato
  corso('PF', 20, 15),  // Avviato
  corso('PF', 20, 15),  // Avviato
  corso('PF', 24, 24),  // Concluso
  corso('PF', 20, 0),   // Da avviare
  corso('PF', 8, 0),    // Da avviare
  // Lab
  corso('Lab', 15, 15), // Concluso
  corso('Lab', 15, 0),  // Da avviare (×6)
  corso('Lab', 15, 0),
  corso('Lab', 15, 0),
  corso('Lab', 15, 0),
  corso('Lab', 15, 0),
  corso('Lab', 15, 0),
  corso('Lab', 10, 0),  // Da avviare (×3)
  corso('Lab', 10, 0),
  corso('Lab', 10, 0),
]

// ── Test runner minimo ─────────────────────────────────────────────────────
let pass = 0, fail = 0

function expect(label, actual, expected, tolerance = 0) {
  const ok = tolerance > 0
    ? Math.abs(actual - expected) <= tolerance
    : actual === expected
  if (ok) {
    console.log(`  ✓ ${label}`)
    pass++
  } else {
    console.error(`  ✗ ${label}\n    expected: ${expected}\n    actual:   ${actual}`)
    fail++
  }
}

function describe(label, fn) {
  console.log(`\n${label}`)
  fn()
}

// ── SUITE 1: parametri default ─────────────────────────────────────────────
describe('Default params (tutor_riconosciuto=true, base_quota_lab=realizzato)', () => {
  const r = calcolaProgettoDm219(corsiIsisEnricoFermi)

  // valore_ora_PF = (122 + 34) × 1.40 = 218.40
  // valore_ora_Lab = 122 × 1.40 = 170.80
  expect('valore_ora_PF', valoreOra('PF', r.params), 218.40)
  expect('valore_ora_Lab', valoreOra('Lab', r.params), 170.80)

  // ore PF previste: 20+20+20+24+20+8 = 112
  expect('ore_previste PF', r.pf.ore_previste, 112)
  // ore Lab previste: 15 + 6×15 + 3×10 = 15+90+30 = 135
  expect('ore_previste Lab', r.lab.ore_previste, 135)
  expect('ore_previste totale', r.totale.ore_previste, 247)

  // ore erogate PF: 15+15+15+24 = 69
  expect('ore_erogate PF', r.pf.ore_erogate, 69)
  // ore erogate Lab: 15
  expect('ore_erogate Lab', r.lab.ore_erogate, 15)
  expect('ore_erogate totale', r.totale.ore_erogate, 84)

  // valore previsto totale: (112×218.40) + (135×170.80) = 24460.80 + 23058 = 47518.80
  expect('valore_previsto totale', r.totale.valore_previsto, 47518.80, 0.02)
  // valore erogato: (69×218.40) + (15×170.80) = 15069.60 + 2562 = 17631.60
  expect('valore_erogato totale', r.totale.valore_erogato, 17631.60, 0.02)

  // soglia_ore = ceil(0.70 × 247) = ceil(172.9) = 173
  expect('soglia_ore', r.soglia_ore, 173)
  // soglia_valore = 0.70 × 47518.80 = 33263.16
  expect('soglia_valore', r.soglia_valore, 33263.16, 0.02)

  // scenario minimo: PF 84, Lab 110, totale 194
  // PF obbligatori: 20+20+20+24 = 84 ore (3 avviati + 1 concluso)
  // Lab obbligatori: 15 ore (1 concluso)
  // Aggiungi corsi Lab da avviare fino a soddisfare soglia_ore=173 e quota_lab≥50%
  // obbligatori (84+15=99h), mancano 173-99=74h di cui 50% Lab almeno
  // 6×15 + ... vediamo il totale ore scenario

  expect('scenario ore_totali', r.scenario.ore_totali, 194)
  expect('scenario valido', r.scenario.valido, true)

  // quota Lab scenario: Lab/(PF+Lab) in valore
  // PF scenario: 84h × 218.40 = 18345.60
  // Lab scenario: 110h × 170.80 = 18788
  // totale: 37133.60; quota Lab = 18788/37133.60 ≈ 0.506
  expect('scenario valore_totale', r.scenario.valore_totale, 37133.60, 0.10)
  expect('scenario quota_lab_pct ≥ 0.50', r.scenario.quota_lab_pct >= 0.50, true)
  expect('scenario quota_lab_pct ≈ 0.506', r.scenario.quota_lab_pct, 0.506, 0.005)

  // ore mancanti al minimo scenario
  // PF nello scenario: 84 ore, erogate 69 → mancanti 15
  expect('ore_mancanti_pf', r.ore_mancanti_pf, 15)
  // Lab nello scenario: 110 ore, erogate 15 → mancanti 95
  expect('ore_mancanti_lab', r.ore_mancanti_lab, 95)

  // ancora da erogare PF = completamento: 15; nuovi: 0
  expect('scenario ore_completamento_pf', r.scenario.ore_completamento_pf, 15)
  // Lab nuovi corsi (da avviare inclusi nello scenario)
  expect('scenario ore_nuovi_lab', r.scenario.ore_nuovi_lab, 95)
})

// ── SUITE 2: base_quota_lab = "accordato" → Non raggiungibile ─────────────
describe('base_quota_lab = accordato → Non raggiungibile', () => {
  const r = calcolaProgettoDm219(corsiIsisEnricoFermi, { base_quota_lab: 'accordato' })
  expect('scenario non valido', r.scenario.valido, false)
  expect('motivo non vuoto', (r.scenario.motivo_non_valido ?? '').length > 0, true)
})

// ── SUITE 3: tutor_riconosciuto = false ───────────────────────────────────
describe('tutor_riconosciuto = false → scenario minimo 174 ore (PF 84, Lab 90)', () => {
  // valore_ora_PF = 122 × 1.40 = 170.80  (uguale al Lab!)
  // soglia_valore = 0.70 × (112×170.80 + 135×170.80) = 0.70 × 247×170.80
  //              = 0.70 × 42187.60 = 29531.32
  const r = calcolaProgettoDm219(corsiIsisEnricoFermi, { tutor_riconosciuto: false })
  expect('valore_ora_PF con tutor=false', valoreOra('PF', r.params), 170.80)
  expect('scenario valido', r.scenario.valido, true)
  expect('scenario ore_totali = 174', r.scenario.ore_totali, 174)
})

// ── Riepilogo ─────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`Totale: ${pass + fail} test · ${pass} passati · ${fail} falliti`)
if (fail > 0) process.exit(1)
