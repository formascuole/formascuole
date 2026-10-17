import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { generateLetteraIncaricoTutorPdf } from '@/lib/generate-lettera-incarico-pdf'

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

        // Step 2: find corsi con tutor assegnato e lettera tutor non ancora generata
        const { data: corsiRaw } = await admin
          .from('corsi')
          .select('id, title, project_id, tutor_id, tipo, modalita, location, ore_tutoraggio, ore_totali, ore_presenza, ore_online, tariffa_oraria_tutor, finanziamento_id')
          .is('lettera_tutor_url', null)
          .not('tutor_id', 'is', null)
          .in('project_id', activeIds)

        const corsi = corsiRaw ?? []
        const total = corsi.length

        send(controller, { type: 'start', total })

        if (total === 0) {
          send(controller, { type: 'complete', processed: 0, total: 0 })
          controller.close()
          return
        }

        // Step 3: batch-fetch tutti i tutor e finanziamenti necessari
        const tutorIds = [...new Set(corsi.map(c => c.tutor_id as string))]
        const finIds = [
          ...new Set(
            corsi
              .map(c => (c.finanziamento_id ?? progettiMap.get(c.project_id as string)?.finanziamento_id ?? null) as string | null)
              .filter((f): f is string => f !== null)
          )
        ]

        const [{ data: tutoriRaw }, { data: finanziamentiRaw }] = await Promise.all([
          admin
            .from('profiles')
            .select('id, nome, email, indirizzo_via, indirizzo_cap, indirizzo_citta, indirizzo_provincia, codice_fiscale, tariffa_oraria_tutor')
            .in('id', tutorIds),
          finIds.length > 0
            ? admin.from('finanziamenti').select('id, nome').in('id', finIds)
            : Promise.resolve({ data: [] }),
        ])

        const tutoriMap = new Map((tutoriRaw ?? []).map(t => [t.id as string, t]))
        const finMap = new Map((finanziamentiRaw ?? []).map(f => [f.id as string, f.nome as string]))

        let processed = 0

        for (const corso of corsi) {
          const progetto = progettiMap.get(corso.project_id as string)
          const tutor = tutoriMap.get(corso.tutor_id as string)

          if (!progetto || !tutor) {
            processed++
            send(controller, { type: 'progress', processed, total, item: corso.title as string, status: 'skip' })
            continue
          }

          try {
            const finId = (corso.finanziamento_id ?? progetto.finanziamento_id ?? null) as string | null
            const finanziamento_nome = finId ? (finMap.get(finId) ?? null) : null

            const tariffaTutor = corso.tariffa_oraria_tutor != null
              ? Number(corso.tariffa_oraria_tutor)
              : (tutor.tariffa_oraria_tutor != null ? Number(tutor.tariffa_oraria_tutor) : null)
            // Fallback a ore_totali se ore_tutoraggio non è valorizzato
            const oreTutoraggio = Number(corso.ore_tutoraggio) > 0
              ? Number(corso.ore_tutoraggio)
              : Number((corso as any).ore_totali || 0)
            const compenso_stimato = tariffaTutor != null && oreTutoraggio > 0
              ? +(oreTutoraggio * tariffaTutor).toFixed(2)
              : null
            const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

            const pdfBuffer = await generateLetteraIncaricoTutorPdf({
              data: today,
              tutor_nome: tutor.nome as string,
              tutor_indirizzo: tutor.indirizzo_via as string | null,
              tutor_cap: tutor.indirizzo_cap as string | null,
              tutor_citta: tutor.indirizzo_citta as string | null,
              tutor_provincia: tutor.indirizzo_provincia as string | null,
              tutor_codice_fiscale: tutor.codice_fiscale as string | null,
              corso_title: corso.title as string,
              corso_edizione: null,
              corso_tipo: corso.tipo as string | null,
              modalita: corso.modalita as string | null,
              location: corso.location as string | null,
              school_name: progetto.school_name as string,
              ore_tutoraggio: oreTutoraggio,
              ore_presenza: (corso.ore_presenza as number | null) ?? null,
              ore_online: (corso.ore_online as number | null) ?? null,
              tariffa_tutor: tariffaTutor,
              compenso_stimato,
              finanziamento_nome,
              firma_admin_nome: null,
            })

            const storagePath = `lettere/${corso.id}/lettera_tutor.pdf`
            await admin.storage.from('notule').upload(storagePath, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true,
            })
            const { data: { publicUrl } } = admin.storage.from('notule').getPublicUrl(storagePath)

            await admin.from('corsi').update({
              lettera_tutor_url: publicUrl,
              lettera_tutor_pending: true,
              lettera_tutor_firmata: false,
              lettera_tutor_firmata_at: null,
              lettera_tutor_ip: null,
              lettera_tutor_inviata_at: null,
              lettera_tutor_sollecito_at: null,
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
