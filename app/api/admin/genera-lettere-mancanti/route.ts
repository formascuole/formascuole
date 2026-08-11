import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { generateLetteraIncaricoFormatorePdf } from '@/lib/generate-lettera-incarico-pdf'

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const isSA = await checkIsSuperAdmin(user.id)
  if (!isSA) return new Response('Forbidden', { status: 403 })

  const admin = createAdminClient()
  const encoder = new TextEncoder()

  function send(controller: ReadableStreamDefaultController, obj: object) {
    controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: fetch all active project IDs
        const { data: activeProgetti } = await admin
          .from('progetti')
          .select('id, school_name, finanziamento_id')
          .eq('status', 'active')

        const activeIds = (activeProgetti ?? []).map(p => p.id as string)
        const progettiMap = new Map((activeProgetti ?? []).map(p => [p.id as string, p]))

        if (activeIds.length === 0) {
          send(controller, { type: 'complete', processed: 0, total: 0 })
          controller.close()
          return
        }

        // Step 2: find qualifying corsi
        const { data: corsiRaw } = await admin
          .from('corsi')
          .select('id, title, project_id, formatore_id, ore_totali, tipo, modalita, location, tariffa_oraria, finanziamento_id')
          .eq('stato_assegnazione', 'accettato')
          .is('lettera_incarico_url', null)
          .not('formatore_id', 'is', null)
          .in('project_id', activeIds)

        const corsi = corsiRaw ?? []
        const total = corsi.length

        send(controller, { type: 'start', total })

        if (total === 0) {
          send(controller, { type: 'complete', processed: 0, total: 0 })
          controller.close()
          return
        }

        // Step 3: batch-fetch all formatori and finanziamenti needed
        const formatoreIds = [...new Set(corsi.map(c => c.formatore_id as string))]
        const finIds = [
          ...new Set(
            corsi
              .map(c => (c.finanziamento_id ?? progettiMap.get(c.project_id as string)?.finanziamento_id ?? null) as string | null)
              .filter((f): f is string => f !== null)
          )
        ]

        const [{ data: formatoriRaw }, { data: finanziamentiRaw }] = await Promise.all([
          admin
            .from('profiles')
            .select('id, nome, indirizzo_via, indirizzo_cap, indirizzo_citta, indirizzo_provincia, codice_fiscale, tariffa_oraria_formatore')
            .in('id', formatoreIds),
          finIds.length > 0
            ? admin.from('finanziamenti').select('id, nome').in('id', finIds)
            : Promise.resolve({ data: [] }),
        ])

        const formatoriMap = new Map((formatoriRaw ?? []).map(f => [f.id as string, f]))
        const finMap = new Map((finanziamentiRaw ?? []).map(f => [f.id as string, f.nome as string]))

        let processed = 0

        for (const corso of corsi) {
          const progetto = progettiMap.get(corso.project_id as string)
          const formatore = formatoriMap.get(corso.formatore_id as string)

          if (!progetto || !formatore) {
            processed++
            send(controller, { type: 'progress', processed, total, item: (corso.title as string), status: 'skip' })
            continue
          }

          try {
            const finId = (corso.finanziamento_id ?? progetto.finanziamento_id ?? null) as string | null
            const finanziamento_nome = finId ? (finMap.get(finId) ?? null) : null

            const tariffa = corso.tariffa_oraria != null
              ? Number(corso.tariffa_oraria)
              : (formatore.tariffa_oraria_formatore != null ? Number(formatore.tariffa_oraria_formatore) : null)
            const oreTotali = Number(corso.ore_totali)
            const compenso_stimato = tariffa != null ? +(oreTotali * tariffa).toFixed(2) : null
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
              compenso_stimato,
              finanziamento_nome,
              firma_admin_nome: null,
            })

            const storagePath = `lettere/${corso.id}/lettera_formatore.pdf`
            await admin.storage.from('notule').upload(storagePath, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true,
            })
            const { data: { publicUrl } } = admin.storage.from('notule').getPublicUrl(storagePath)

            await admin.from('corsi').update({
              lettera_incarico_url: publicUrl,
              lettera_incarico_pending: true,
              lettera_incarico_firmata: false,
              lettera_incarico_firmata_at: null,
              lettera_incarico_ip: null,
              lettera_incarico_inviata_at: null,
              lettera_incarico_sollecito_at: null,
            }).eq('id', corso.id as string)

            processed++
            send(controller, { type: 'progress', processed, total, item: corso.title as string, status: 'ok' })
          } catch (err) {
            processed++
            send(controller, {
              type: 'progress', processed, total,
              item: corso.title as string,
              status: 'error',
              error: String(err),
            })
          }
        }

        send(controller, { type: 'complete', processed, total })
      } catch (err) {
        send(controller, { type: 'error', message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
