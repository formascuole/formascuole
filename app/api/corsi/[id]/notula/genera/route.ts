import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcFinancials } from '@/lib/economia-utils'
import { generateNotulaPdf } from '@/lib/generate-notula-pdf'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const numero: string = (body.numero as string)?.trim()
  if (!numero) return NextResponse.json({ error: 'Numero ricevuta obbligatorio' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch corso
  const { data: corso } = await admin.from('corsi').select('*').eq('id', corsoId).single()
  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })
  if (!corso.formatore_id) return NextResponse.json({ error: 'Nessun formatore assegnato' }, { status: 400 })

  // Verify caller is the assigned formatore OR an admin
  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(callerProfile?.role)
  if (!isAdmin && corso.formatore_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch formatore, progetto, sessioni
  const [{ data: formatore }, { data: progetto }, { data: sessioni }] = await Promise.all([
    admin.from('profiles').select('*').eq('id', corso.formatore_id).single(),
    admin.from('progetti').select('school_name').eq('id', corso.project_id).single(),
    admin.from('sessioni').select('data, ore').eq('corso_id', corsoId).eq('completata', true).order('data'),
  ])
  if (!formatore) return NextResponse.json({ error: 'Formatore non trovato' }, { status: 404 })

  const oreErogate = (sessioni || []).reduce((s: number, r: { ore: number }) => s + Number(r.ore), 0)
  const prima = sessioni?.[0]?.data ?? null
  const ultima = sessioni?.[sessioni.length - 1]?.data ?? null

  const tariffa = (corso.tariffa_oraria as number | null) ?? (formatore.tariffa_oraria_formatore as number | null) ?? 0
  const regime = (formatore.regime_fiscale ?? 'notula') as 'notula' | 'forfettario' | 'ordinario'
  const rivalsa = formatore.rivalsa_iva ?? false
  const fin = calcFinancials(oreErogate, tariffa, regime, rivalsa)

  const today = new Date()
  const dataFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`

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
    titolo_corso: corso.title as string,
    school_name: progetto?.school_name ?? '—',
    prima_sessione: prima,
    ultima_sessione: ultima,
    ore_erogate: oreErogate,
    tariffa,
    regime,
    rivalsa_iva: rivalsa,
    imponibile: fin.imponibile,
    ritenuteIva: fin.ritenuteIva,
    netto: fin.netto,
  })

  // Upload to Supabase Storage
  const path = `${corso.formatore_id}/${corsoId}/notula_${numero.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
  const { error: uploadError } = await admin.storage.from('notule').upload(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('notule').getPublicUrl(path)

  // Update corso
  await admin.from('corsi').update({
    notula_numero: numero,
    notula_stato: 'bozza',
    notula_pdf_url: publicUrl,
    notula_motivazione_rifiuto: null,
  }).eq('id', corsoId)

  return NextResponse.json({ pdf_url: publicUrl })
}
