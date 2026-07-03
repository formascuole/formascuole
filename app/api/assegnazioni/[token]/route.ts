import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateRispostaAssegnazioniAdminEmail, sendEmail } from '@/lib/email'
import { generateLetteraIncaricoFormatorePdf } from '@/lib/generate-lettera-incarico-pdf'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

interface Decision {
  corso_id: string
  risposta: 'accettato' | 'rifiutato'
  motivazione?: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { decisions } = await request.json() as { decisions: Decision[] }
  if (!decisions?.length) return NextResponse.json({ error: 'Nessuna decisione' }, { status: 400 })

  const { data: corsi } = await admin
    .from('corsi')
    .select('id, title, tipo, formatore_id, project_id, accettazione_richiesta_at, ore_totali, tariffa_oraria')
    .eq('token_assegnazione', token)
    .eq('stato_assegnazione', 'in_attesa')

  if (!corsi?.length) return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 404 })

  const richiesta = corsi[0].accettazione_richiesta_at
  if (!richiesta || Date.now() - new Date(richiesta).getTime() > 48 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Link scaduto' }, { status: 410 })
  }

  const corsoIds = new Set(corsi.map(c => c.id))
  const now = new Date().toISOString()
  const accettati: { title: string }[] = []
  const accettatiCorsi: typeof corsi = []
  const rifiutati: { title: string; motivazione?: string }[] = []

  for (const d of decisions) {
    if (!corsoIds.has(d.corso_id)) continue
    const corso = corsi.find(c => c.id === d.corso_id)!
    if (d.risposta === 'accettato') {
      await admin.from('corsi').update({
        stato_assegnazione: 'accettato',
        accettazione_risposta_at: now,
        rifiuto_motivazione: null,
      }).eq('id', d.corso_id)
      accettati.push({ title: corso.title })
      accettatiCorsi.push(corso)
    } else {
      await admin.from('corsi').update({
        stato_assegnazione: 'rifiutato',
        formatore_id: null,
        accettazione_risposta_at: now,
        rifiuto_motivazione: d.motivazione || null,
      }).eq('id', d.corso_id)
      rifiutati.push({ title: corso.title, motivazione: d.motivazione })
    }
  }

  const formatoreId = corsi[0].formatore_id
  const progettoId = corsi[0].project_id

  const [{ data: formatore }, { data: progetto }, { data: admins }] = await Promise.all([
    admin.from('profiles').select('nome, email, indirizzo_via, indirizzo_cap, indirizzo_citta, indirizzo_provincia, codice_fiscale, tariffa_oraria_formatore').eq('id', formatoreId).single(),
    admin.from('progetti').select('school_name, status').eq('id', progettoId).single(),
    admin.from('profiles').select('email').in('role', ['admin', 'super_admin']),
  ])

  // Auto-generate lettere incarico for each accepted corso (only for active projects)
  if (formatore && progetto && progetto.status === 'attivo' && accettatiCorsi.length > 0) {
    for (const corso of accettatiCorsi) {
      try {
        const tariffa = corso.tariffa_oraria != null
          ? Number(corso.tariffa_oraria)
          : (formatore.tariffa_oraria_formatore != null ? Number(formatore.tariffa_oraria_formatore) : null)
        const oreTotali = Number(corso.ore_totali)
        const compensoStimato = tariffa != null ? +(oreTotali * tariffa).toFixed(2) : null
        const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

        const pdfBuffer = await generateLetteraIncaricoFormatorePdf({
          data: today,
          formatore_nome: formatore.nome as string,
          formatore_indirizzo: formatore.indirizzo_via as string | null,
          formatore_cap: formatore.indirizzo_cap as string | null,
          formatore_citta: formatore.indirizzo_citta as string | null,
          formatore_provincia: formatore.indirizzo_provincia as string | null,
          formatore_codice_fiscale: formatore.codice_fiscale as string | null,
          corso_title: corso.title as string,
          corso_tipo: corso.tipo as string,
          school_name: progetto.school_name as string,
          ore_totali: oreTotali,
          tariffa,
          compenso_stimato: compensoStimato,
          firma_admin_nome: null,
        })

        const storagePath = `lettere/${corso.id}/lettera_formatore.pdf`
        await admin.storage.from('notule').upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
        const { data: { publicUrl } } = admin.storage.from('notule').getPublicUrl(storagePath)

        await admin.from('corsi').update({
          lettera_incarico_url: publicUrl,
          lettera_incarico_pending: true,
          lettera_incarico_firmata: false,
          lettera_incarico_firmata_at: null,
          lettera_incarico_ip: null,
          lettera_incarico_inviata_at: null,
          lettera_incarico_sollecito_at: null,
        }).eq('id', corso.id)
      } catch (err) {
        console.error(`[assegnazioni/token] Lettera generation failed for corso ${corso.id} (non-fatal):`, err)
      }
    }
  }

  if (formatore && progetto && admins?.length) {
    try {
      const body = await generateRispostaAssegnazioniAdminEmail({
        formatore_nome: formatore.nome as string,
        school_name: progetto.school_name as string,
        accettati,
        rifiutati,
        progetto_url: `${APP_URL}/progetti/${progettoId}`,
      })
      for (const a of admins) {
        await sendEmail({
          to: a.email,
          subject: `Risposta assegnazioni — ${formatore.nome} — ${progetto.school_name}`,
          body,
          actions: [{ label: '→ Apri progetto', url: `${APP_URL}/progetti/${progettoId}`, primary: true }],
        }).catch(() => {})
      }
    } catch (err) {
      console.error('[assegnazioni/token] Admin notify error:', err)
    }
  }

  return NextResponse.json({ accettati: accettati.length, rifiutati: rifiutati.length })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: corsi } = await admin
    .from('corsi')
    .select('id, title, tipo, ore_totali, modalita, pre_assegnazione, stato_assegnazione, accettazione_richiesta_at, formatore_id, project_id, referente_corso_nome, referente_corso_email, referente_corso_telefono, referente_corso_ruolo')
    .eq('token_assegnazione', token)

  if (!corsi?.length) return NextResponse.json({ error: 'Token non trovato' }, { status: 404 })

  const progettoId = corsi[0].project_id
  const { data: progetto } = await admin
    .from('progetti')
    .select('school_name, address, ref_name, ref_email, ref_tel')
    .eq('id', progettoId)
    .single()

  const richiesta = corsi[0].accettazione_richiesta_at
  const scaduto = !richiesta || Date.now() - new Date(richiesta).getTime() > 48 * 60 * 60 * 1000
  const scadenzaAt = richiesta ? new Date(new Date(richiesta).getTime() + 48 * 60 * 60 * 1000).toISOString() : null

  return NextResponse.json({ corsi, progetto, scaduto, scadenzaAt })
}
