import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcFinancials } from '@/lib/economia-utils'
import { generateNotulaPdf, NotulaCorsoItem } from '@/lib/generate-notula-pdf'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const numero: string = (body.numero as string)?.trim()
  const corsoIds: string[] = body.corso_ids ?? []
  const formatoreId: string = body.formatore_id

  if (!numero) return NextResponse.json({ error: 'Numero ricevuta obbligatorio' }, { status: 400 })
  if (!corsoIds.length) return NextResponse.json({ error: 'Almeno un corso obbligatorio' }, { status: 400 })
  if (!formatoreId) return NextResponse.json({ error: 'Formatore obbligatorio' }, { status: 400 })

  // Verify caller is the formatore or admin
  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(callerProfile?.role ?? '')
  if (!isAdmin && user.id !== formatoreId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch formatore profile
  const { data: formatore } = await admin.from('profiles').select('*').eq('id', formatoreId).single()
  if (!formatore) return NextResponse.json({ error: 'Formatore non trovato' }, { status: 404 })

  // Fetch all corsi and their data
  const { data: corsiRaw } = await admin
    .from('corsi')
    .select('id, title, project_id, tariffa_oraria, notula_id')
    .in('id', corsoIds)

  if (!corsiRaw || corsiRaw.length !== corsoIds.length) {
    return NextResponse.json({ error: 'Uno o più corsi non trovati' }, { status: 404 })
  }

  // Check none already have a notula
  const alreadyAssigned = corsiRaw.filter(c => c.notula_id)
  if (alreadyAssigned.length > 0) {
    return NextResponse.json({ error: 'Alcuni corsi sono già associati a una notula' }, { status: 400 })
  }

  // Fetch progetti for school names
  const projectIds = [...new Set(corsiRaw.map(c => c.project_id))]
  const { data: progettiRaw } = await admin.from('progetti').select('id, school_name').in('id', projectIds)
  const progettiMap = new Map((progettiRaw || []).map(p => [p.id, p.school_name as string]))

  // Fetch sessioni completate per corso
  const { data: sessioniRaw } = await admin
    .from('sessioni')
    .select('corso_id, data, ore')
    .in('corso_id', corsoIds)
    .eq('completata', true)
    .order('data')

  type SessionAgg = { ore_erogate: number; prima: string | null; ultima: string | null }
  const sessionByCorso = new Map<string, SessionAgg>()
  for (const s of sessioniRaw || []) {
    const cur = sessionByCorso.get(s.corso_id as string) ?? { ore_erogate: 0, prima: null, ultima: null }
    cur.ore_erogate += Number(s.ore)
    if (!cur.prima || (s.data as string) < cur.prima) cur.prima = s.data as string
    if (!cur.ultima || (s.data as string) > cur.ultima) cur.ultima = s.data as string
    sessionByCorso.set(s.corso_id as string, cur)
  }

  const regime = (formatore.regime_fiscale ?? 'notula') as 'notula' | 'forfettario' | 'ordinario'
  const rivalsa = formatore.rivalsa_iva ?? false
  const tariffaProfile = (formatore.tariffa_oraria_formatore as number | null) ?? 0

  // Build NotulaCorsoItem[] and per-corso importo
  const corsiItems: NotulaCorsoItem[] = []
  const notuleCorsiRows: Array<{
    corso_id: string
    importo: number
    ore_erogate: number
    tariffa_oraria: number
  }> = []

  let importoTotale = 0
  for (const c of corsiRaw) {
    const agg = sessionByCorso.get(c.id as string) ?? { ore_erogate: 0, prima: null, ultima: null }
    const tariffa = (c.tariffa_oraria as number | null) ?? tariffaProfile
    const importo = agg.ore_erogate * tariffa
    importoTotale += importo
    const schoolName = progettiMap.get(c.project_id as string) ?? '—'
    corsiItems.push({
      titolo_corso: c.title as string,
      school_name: schoolName,
      prima_sessione: agg.prima,
      ultima_sessione: agg.ultima,
      ore_erogate: agg.ore_erogate,
      tariffa,
      importo,
    })
    notuleCorsiRows.push({
      corso_id: c.id as string,
      importo,
      ore_erogate: agg.ore_erogate,
      tariffa_oraria: tariffa,
    })
  }

  // Calculate financials on total
  const totalOre = notuleCorsiRows.reduce((s, r) => s + r.ore_erogate, 0)
  const fin = calcFinancials(totalOre, importoTotale / Math.max(totalOre, 1), regime, rivalsa)
  // Use importo_totale directly since calcFinancials uses ore*tariffa
  const ritenuta = regime === 'notula' ? +(importoTotale * 0.2).toFixed(2) : 0
  const iva = (regime === 'ordinario' && rivalsa) ? +(importoTotale * 0.22).toFixed(2) : 0
  const netto = regime === 'notula'
    ? +(importoTotale - ritenuta).toFixed(2)
    : (regime === 'ordinario' && rivalsa)
      ? +(importoTotale + iva).toFixed(2)
      : importoTotale

  // Generate PDF
  const today = new Date()
  const dataFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
  const tipo: 'singola' | 'cumulativa' = corsoIds.length > 1 ? 'cumulativa' : 'singola'

  const pdfBuffer = await generateNotulaPdf({
    numero,
    data: dataFormatted,
    formatore_nome: formatore.nome as string,
    luogo_nascita: formatore.luogo_nascita ?? null,
    data_nascita: formatore.data_nascita ?? null,
    codice_fiscale: formatore.codice_fiscale ?? null,
    indirizzo_via: formatore.indirizzo_via ?? null,
    indirizzo_cap: formatore.indirizzo_cap ?? null,
    indirizzo_citta: formatore.indirizzo_citta ?? null,
    indirizzo_provincia: formatore.indirizzo_provincia ?? null,
    iban: formatore.iban ?? null,
    banca: formatore.banca ?? null,
    intestatario_conto: formatore.intestatario_conto ?? null,
    tipo,
    corsi: corsiItems,
    regime,
    rivalsa_iva: rivalsa,
    importo_totale: importoTotale,
    ritenuta,
    iva,
    netto,
  })

  // Generate notula ID ahead of time for storage path
  const notulaId = randomUUID()
  const storagePath = `notule/${formatoreId}/${notulaId}.pdf`

  const { error: uploadError } = await admin.storage.from('notule').upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('notule').getPublicUrl(storagePath)

  // Insert notula
  const { data: notula, error: notulaError } = await admin.from('notule').insert({
    id: notulaId,
    numero,
    formatore_id: formatoreId,
    stato: 'bozza',
    tipo,
    importo_totale: +importoTotale.toFixed(2),
    ritenuta,
    iva,
    netto,
    pdf_url: publicUrl,
    token: null,
  }).select().single()

  if (notulaError) return NextResponse.json({ error: notulaError.message }, { status: 500 })

  // Insert notule_corsi pivot rows
  const pivotRows = notuleCorsiRows.map(r => ({
    notula_id: notulaId,
    corso_id: r.corso_id,
    importo: +r.importo.toFixed(2),
    ore_erogate: r.ore_erogate,
    tariffa_oraria: r.tariffa_oraria,
  }))
  await admin.from('notule_corsi').insert(pivotRows)

  // Update each corso with notula_id
  await admin.from('corsi').update({ notula_id: notulaId }).in('id', corsoIds)

  return NextResponse.json({ notula })
}
