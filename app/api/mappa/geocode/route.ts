import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { PROVINCE_COORDS, REGIONE_COORDS } from '@/lib/geo-utils'

const UA = 'Formascuole/1.0 (formazione@formascuole.it)'
const DELAY_MS = 1100

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function nominatim(query: string): Promise<[number, number] | null> {
  if (!query.trim()) return null
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=it`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
    }
    return null
  } catch {
    return null
  }
}

function provinceFallback(
  provincia: string | null | undefined,
  regione: string | null | undefined,
): [number, number] | null {
  if (provincia) {
    const code = provincia.toUpperCase().trim()
    if (PROVINCE_COORDS[code]) return PROVINCE_COORDS[code]
  }
  if (regione) {
    if (REGIONE_COORDS[regione]) return REGIONE_COORDS[regione]
  }
  return null
}

export async function POST(req: NextRequest) {
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
        // Fetch projects without coordinates
        const { data: progetti } = await admin
          .from('progetti')
          .select('id, school_name, address, citta, provincia, regione')
          .or('lat.is.null,lng.is.null')

        // Fetch formatori/tutor without coordinates
        const { data: formatori } = await admin
          .from('profiles')
          .select('id, nome, indirizzo_via, indirizzo_citta, indirizzo_provincia, regione')
          .in('role', ['formatore', 'tutor'])
          .or('lat.is.null,lng.is.null')

        const totalP = (progetti ?? []).length
        const totalF = (formatori ?? []).length
        const total = totalP + totalF

        send(controller, { type: 'start', totalProjects: totalP, totalFormatori: totalF })

        let processed = 0

        for (const p of progetti ?? []) {
          const parts = [
            p.address,
            p.citta,
            p.provincia ? p.provincia.toUpperCase() : null,
            'Italia',
          ].filter(Boolean)
          const query = parts.join(', ')

          let coords = await nominatim(query)
          if (!coords) {
            coords = provinceFallback(p.provincia, p.regione)
          }

          if (coords) {
            await admin
              .from('progetti')
              .update({ lat: coords[0], lng: coords[1] })
              .eq('id', p.id)
          }

          processed++
          send(controller, {
            type: 'progress',
            processed,
            total,
            item: p.school_name,
            source: coords ? 'geocoded' : 'skipped',
          })

          await sleep(DELAY_MS)
        }

        for (const f of formatori ?? []) {
          const parts = [
            f.indirizzo_via,
            f.indirizzo_citta,
            f.indirizzo_provincia ? f.indirizzo_provincia.toUpperCase() : null,
            'Italia',
          ].filter(Boolean)

          let coords: [number, number] | null = null
          if (parts.length > 1) {
            coords = await nominatim(parts.join(', '))
          }
          if (!coords) {
            coords = provinceFallback(f.indirizzo_provincia, f.regione)
          }

          if (coords) {
            await admin
              .from('profiles')
              .update({ lat: coords[0], lng: coords[1] })
              .eq('id', f.id)
          }

          processed++
          send(controller, {
            type: 'progress',
            processed,
            total,
            item: f.nome,
            source: coords ? 'geocoded' : 'skipped',
          })

          await sleep(DELAY_MS)
        }

        send(controller, { type: 'complete', processed })
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
