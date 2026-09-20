import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

type DigestRecord = {
  id: string
  tipo: string
  payload: Record<string, unknown>
  created_at: string
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const todayStart = `${todayStr}T00:00:00.000Z`

  try {
    // Fetch all unsent records created today
    const { data: records, error } = await supabase
      .from('admin_digest_log')
      .select('id, tipo, payload, created_at')
      .eq('inviato', false)
      .gte('created_at', todayStart)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[admin-digest] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ success: true, sent: false, reason: 'no_events_today' })
    }

    const rows = records as DigestRecord[]
    const byTipo = new Map<string, DigestRecord[]>()
    for (const r of rows) {
      const arr = byTipo.get(r.tipo) ?? []
      arr.push(r)
      byTipo.set(r.tipo, arr)
    }

    const sessioni_modificate = byTipo.get('sessione_modificata') ?? []
    const accettazioni = byTipo.get('accettazione_corso') ?? []
    const nessuna_risposta = byTipo.get('nessuna_risposta') ?? []
    const corsi_da_concludere = byTipo.get('corso_da_concludere') ?? []

    const todayFmt = now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const lines: string[] = [
      `Buonasera,`,
      ``,
      `ecco il riepilogo delle attività di oggi ${todayFmt}:`,
      ``,
    ]

    if (sessioni_modificate.length > 0) {
      lines.push(`── SESSIONI MODIFICATE (${sessioni_modificate.length}) ──`)
      for (const r of sessioni_modificate) {
        const p = r.payload
        lines.push(`• ${p.titolo_corso ?? '—'} — ${p.scuola ?? '—'}`)
        lines.push(`  Formatore: ${p.formatore ?? '—'}`)
        if (p.data_sessione) lines.push(`  Data sessione: ${p.data_sessione}`)
        if (p.ora_vecchia || p.ora_nuova) lines.push(`  Modifica ore: ${p.ora_vecchia ?? '?'} → ${p.ora_nuova ?? '?'}`)
        if (p.motivazione) lines.push(`  Motivazione: ${p.motivazione}`)
      }
      lines.push(``)
    }

    if (accettazioni.length > 0) {
      lines.push(`── ACCETTAZIONI CORSI (${accettazioni.length}) ──`)
      for (const r of accettazioni) {
        const p = r.payload
        const esito = p.risposta === 'accettato' ? '✅ Accettato' : '❌ Rifiutato'
        lines.push(`• ${p.titolo_corso ?? '—'} — ${p.scuola ?? '—'}`)
        lines.push(`  Formatore: ${p.formatore ?? '—'} — ${esito}`)
        if (p.motivazione) lines.push(`  Motivazione: ${p.motivazione}`)
      }
      lines.push(``)
    }

    if (nessuna_risposta.length > 0) {
      lines.push(`── IN ATTESA DI RISPOSTA (${nessuna_risposta.length}) ──`)
      for (const r of nessuna_risposta) {
        const p = r.payload
        const dataInvio = p.data_invio_notifica
          ? new Date(p.data_invio_notifica as string).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : '—'
        lines.push(`• ${p.titolo_corso ?? '—'} — ${p.scuola ?? '—'}`)
        lines.push(`  Formatore: ${p.formatore ?? '—'}`)
        lines.push(`  Notifica inviata il: ${dataInvio}`)
      }
      lines.push(``)
    }

    if (corsi_da_concludere.length > 0) {
      lines.push(`── CORSI DA CONCLUDERE (${corsi_da_concludere.length}) ──`)
      for (const r of corsi_da_concludere) {
        const p = r.payload
        lines.push(`• ${p.titolo_corso ?? '—'} — ${p.scuola ?? '—'}`)
        lines.push(`  Formatore: ${p.formatore ?? '—'}`)
        lines.push(`  Ore erogate: ${p.ore_erogate ?? '?'}h su ${p.ore_totali ?? '?'}h`)
      }
      lines.push(``)
    }

    lines.push(`Cordiali saluti,`)
    lines.push(`Il team Formascuole`)

    const subject = `📊 Riepilogo giornaliero Formascuole — ${todayFmt}`
    const body = lines.join('\n')

    const { data: admins } = await supabase
      .from('profiles')
      .select('email')
      .in('role', ['admin', 'super_admin'])
    const adminEmails = (admins || []).map(a => a.email as string).filter(Boolean)

    await Promise.allSettled(
      adminEmails.map(email =>
        sendEmail({
          to: email,
          subject,
          body,
          actions: [{ label: 'Vai alla piattaforma →', url: APP_URL, primary: true }],
        })
      )
    )

    // Mark all records as sent
    const ids = rows.map(r => r.id)
    await supabase
      .from('admin_digest_log')
      .update({ inviato: true, inviato_at: now.toISOString() })
      .in('id', ids)

    return NextResponse.json({
      success: true,
      sent: true,
      admin_count: adminEmails.length,
      events: {
        sessioni_modificate: sessioni_modificate.length,
        accettazioni: accettazioni.length,
        nessuna_risposta: nessuna_risposta.length,
        corsi_da_concludere: corsi_da_concludere.length,
      },
    })
  } catch (err) {
    console.error('[admin-digest] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
