import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateRispostaAssegnazioniAdminEmail, sendEmail } from '@/lib/email'

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

  // Verify token and fetch courses
  const { data: corsi } = await admin
    .from('corsi')
    .select('id, title, tipo, formatore_id, project_id, accettazione_richiesta_at')
    .eq('token_assegnazione', token)
    .eq('stato_assegnazione', 'in_attesa')

  if (!corsi?.length) return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 404 })

  // Check token expiry (48h from accettazione_richiesta_at)
  const richiesta = corsi[0].accettazione_richiesta_at
  if (!richiesta || Date.now() - new Date(richiesta).getTime() > 48 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Link scaduto' }, { status: 410 })
  }

  const corsoIds = new Set(corsi.map(c => c.id))
  const now = new Date().toISOString()
  const accettati: { title: string }[] = []
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

  // Notify admins
  const formatoreId = corsi[0].formatore_id
  const progettoId = corsi[0].project_id

  const [{ data: formatore }, { data: progetto }, { data: admins }] = await Promise.all([
    admin.from('profiles').select('nome, email').eq('id', formatoreId).single(),
    admin.from('progetti').select('school_name').eq('id', progettoId).single(),
    admin.from('profiles').select('email').in('role', ['admin', 'super_admin']),
  ])

  if (formatore && progetto && admins?.length) {
    try {
      const body = await generateRispostaAssegnazioniAdminEmail({
        formatore_nome: formatore.nome,
        school_name: progetto.school_name,
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
