import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEmailConfermaPreAssegnazione, sendEmail } from '@/lib/email'
import { generateLetteraIncaricoFormatorePdf } from '@/lib/generate-lettera-incarico-pdf'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: progettoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { corso_ids } = await request.json() as { corso_ids: string[] }
  if (!corso_ids?.length) return NextResponse.json({ success: true })

  const admin = createAdminClient()

  // Fetch corsi data before confirming, to send notification emails
  const { data: corsi, error: corsiErr } = await admin
    .from('corsi')
    .select('id, title, tipo, ore_totali, modalita, formatore_id, project_id')
    .in('id', corso_ids)
    .eq('project_id', progettoId)
    .not('formatore_id', 'is', null)

  if (corsiErr) return NextResponse.json({ error: corsiErr.message }, { status: 500 })

  // Mark as definitive assignments (not pre-assigned, mark as notified)
  const { error } = await admin
    .from('corsi')
    .update({ pre_assegnazione: false, notificato: true })
    .in('id', corso_ids)
    .eq('project_id', progettoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: progetto } = await admin
    .from('progetti')
    .select('school_name, finanziamento_id')
    .eq('id', progettoId)
    .single()

  // Send confirmation email to each formatore
  if (corsi?.length && progetto) {
    const byFormatore = new Map<string, typeof corsi>()
    for (const c of corsi) {
      const key = c.formatore_id as string
      if (!byFormatore.has(key)) byFormatore.set(key, [])
      byFormatore.get(key)!.push(c)
    }

    for (const [formatoreId, fCorsi] of byFormatore) {
      try {
        const { data: formatore } = await admin
          .from('profiles')
          .select('nome, email')
          .eq('id', formatoreId)
          .single()

        if (!formatore?.email) continue

        const body = await generateEmailConfermaPreAssegnazione({
          formatore_nome: formatore.nome as string,
          corsi: fCorsi.map(c => ({
            title: c.title as string,
            tipo: c.tipo as string,
            ore_totali: Number(c.ore_totali),
            modalita: c.modalita as string | null,
          })),
          school_name: progetto.school_name as string,
          piattaforma_url: `${APP_URL}/formatore`,
        })

        await sendEmail({
          to: formatore.email as string,
          subject: `Progetto attivato — assegnazioni confermate — ${progetto.school_name}`,
          body,
          actions: [{ label: 'Accedi alla piattaforma', url: `${APP_URL}/formatore`, primary: true }],
        })
      } catch (err) {
        console.error('[conferma-pre-assegnazioni] Email send failed (non-fatal):', err)
      }
    }
  }

  // Auto-generate lettere incarico for all accepted corsi without a letter
  try {
    const { data: corsiSenzaLettera } = await admin
      .from('corsi')
      .select('id, title, tipo, modalita, location, ore_totali, tariffa_oraria, formatore_id, finanziamento_id')
      .eq('project_id', progettoId)
      .eq('stato_assegnazione', 'accettato')
      .is('lettera_incarico_url', null)
      .not('formatore_id', 'is', null)

    if (corsiSenzaLettera?.length && progetto) {
      const byFormatore = new Map<string, typeof corsiSenzaLettera>()
      for (const c of corsiSenzaLettera) {
        const key = c.formatore_id as string
        if (!byFormatore.has(key)) byFormatore.set(key, [])
        byFormatore.get(key)!.push(c)
      }

      for (const [formatoreId, fCorsi] of byFormatore) {
        try {
          const { data: formatore } = await admin
            .from('profiles')
            .select('nome, indirizzo_via, indirizzo_cap, indirizzo_citta, indirizzo_provincia, codice_fiscale, tariffa_oraria_formatore')
            .eq('id', formatoreId)
            .single()

          if (!formatore) continue

          for (const corso of fCorsi) {
            try {
              const finId = (corso.finanziamento_id || progetto.finanziamento_id) as string | null
              let finanziamento_nome: string | null = null
              if (finId) {
                const { data: fin } = await admin.from('finanziamenti').select('nome').eq('id', finId).single()
                finanziamento_nome = (fin?.nome as string | null) ?? null
              }

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
                modalita: corso.modalita as string | null,
                location: corso.location as string | null,
                school_name: progetto.school_name as string,
                ore_totali: oreTotali,
                tariffa,
                compenso_stimato: compensoStimato,
                finanziamento_nome,
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
              console.error(`[conferma-pre-assegnazioni] Lettera generation failed for corso ${corso.id} (non-fatal):`, err)
            }
          }
        } catch (err) {
          console.error(`[conferma-pre-assegnazioni] Lettera batch failed for formatore ${formatoreId} (non-fatal):`, err)
        }
      }
    }
  } catch (err) {
    console.error('[conferma-pre-assegnazioni] Lettera generation phase failed (non-fatal):', err)
  }

  return NextResponse.json({ success: true })
}
