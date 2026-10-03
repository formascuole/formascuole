import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'

// GET /api/export/calendari?project_id=<id>
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')

  const admin = createAdminClient()

  let corsiQuery = admin
    .from('corsi_con_ore')
    .select('id, project_id, title, tipo, ore_totali, ore_pianificate, calendario_inviato_at, calendario_confermato, calendario_confermato_at, confermato_manualmente, formatore:profiles!formatore_id(id,nome,email)')
    .neq('corso_completato', true)
    .order('created_at')

  if (projectId) corsiQuery = corsiQuery.eq('project_id', projectId)

  const { data: corsiRaw, error: corsiErr } = await corsiQuery
  if (corsiErr) return NextResponse.json({ error: corsiErr.message }, { status: 500 })
  const corsi = corsiRaw || []
  const corsiIds = corsi.map(c => c.id)

  let sessioni: { id: string; corso_id: string; data: string; ora_inizio: string | null; ora_fine: string | null; ore: number; completata: boolean }[] = []
  if (corsiIds.length > 0) {
    const { data: sessRaw } = await admin
      .from('sessioni')
      .select('id, corso_id, data, ora_inizio, ora_fine, ore, completata')
      .in('corso_id', corsiIds)
      .order('data')
      .order('ora_inizio')
    sessioni = (sessRaw || []) as typeof sessioni
  }

  const projectIds = [...new Set(corsi.map(c => c.project_id))]
  const progettiMap = new Map<string, { school_name: string }>()
  if (projectIds.length > 0) {
    const { data: progettiRaw } = await admin.from('progetti').select('id, school_name').in('id', projectIds)
    for (const p of progettiRaw || []) progettiMap.set(p.id, p)
  }

  const sessioniByCorso = new Map<string, typeof sessioni>()
  for (const s of sessioni) {
    const arr = sessioniByCorso.get(s.corso_id) ?? []
    arr.push(s)
    sessioniByCorso.set(s.corso_id, arr)
  }

  function statoCalendario(c: typeof corsi[0]): string {
    if (c.calendario_confermato) return c.confermato_manualmente ? 'Confermato (manuale)' : 'Confermato dalla scuola'
    if (c.calendario_inviato_at) return 'Inviato — in attesa conferma'
    const nSess = sessioniByCorso.get(c.id)?.length ?? 0
    if (nSess > 0) {
      const completo = (c.ore_pianificate ?? 0) >= (c.ore_totali ?? 0)
      return completo ? 'Pianificato — non inviato' : 'Pianificato — parziale'
    }
    return 'Nessuna sessione'
  }

  function formatData(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }
  function formatDatetime(isoStr: string) {
    const d = new Date(isoStr)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const wb = XLSX.utils.book_new()
  const giorni = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

  // Foglio 1: Riepilogo
  const riepilogoHeader = ['Scuola', 'Corso', 'Tipo', 'Ore tot.', 'Formatore', 'N. sessioni', 'Ore pianificate', 'Stato calendario', 'Inviato il', 'Confermato il']
  const riepilogoRows = corsi
    .filter(c => (sessioniByCorso.get(c.id)?.length ?? 0) > 0 || c.calendario_inviato_at || c.calendario_confermato)
    .map(c => {
      const sessCorso = sessioniByCorso.get(c.id) ?? []
      const orePianificate = sessCorso.reduce((s, s2) => s + Number(s2.ore), 0)
      const fmt = c.formatore as { nome?: string } | null
      return [
        progettiMap.get(c.project_id)?.school_name ?? '—',
        c.title ?? '—', c.tipo ?? '—', c.ore_totali ?? 0, fmt?.nome ?? '—',
        sessCorso.length, orePianificate, statoCalendario(c),
        c.calendario_inviato_at ? formatDatetime(c.calendario_inviato_at) : '—',
        c.calendario_confermato_at ? formatDatetime(c.calendario_confermato_at as string) : '—',
      ]
    })

  const ws1 = XLSX.utils.aoa_to_sheet([riepilogoHeader, ...riepilogoRows])
  ws1['!cols'] = [{ wch: 36 }, { wch: 34 }, { wch: 8 }, { wch: 8 }, { wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 26 }, { wch: 20 }, { wch: 20 }]
  const hFill1 = { patternType: 'solid', fgColor: { rgb: '2D3748' } }
  const hFont1 = { bold: true, color: { rgb: 'FFFFFF' } }
  for (let ci = 0; ci < riepilogoHeader.length; ci++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci })
    if (!ws1[ref]) ws1[ref] = { t: 's', v: '' }
    ws1[ref].s = { fill: hFill1, font: hFont1 }
  }
  XLSX.utils.book_append_sheet(wb, ws1, 'Riepilogo calendari')

  // Foglio 2: Dettaglio sessioni
  const ws2Rows: unknown[][] = []
  const ws2HeaderRows: number[] = []
  const ws2AltRows: number[] = []
  const tipoOrder: Record<string, number> = { PF: 0, Lab: 1, MF: 2 }
  const corsiOrdinati = [...corsi]
    .filter(c => (sessioniByCorso.get(c.id)?.length ?? 0) > 0)
    .sort((a, b) => {
      if (!projectId) {
        const pa = progettiMap.get(a.project_id)?.school_name ?? ''
        const pb = progettiMap.get(b.project_id)?.school_name ?? ''
        if (pa !== pb) return pa.localeCompare(pb)
      }
      return (tipoOrder[a.tipo ?? ''] ?? 99) - (tipoOrder[b.tipo ?? ''] ?? 99) || (a.title ?? '').localeCompare(b.title ?? '')
    })

  for (const corso of corsiOrdinati) {
    const sessCorso = (sessioniByCorso.get(corso.id) ?? []).sort((a, b) => a.data.localeCompare(b.data))
    const fmt = corso.formatore as { nome?: string } | null
    const titolo = projectId
      ? `${corso.title ?? '—'} — ${fmt?.nome ?? 'Nessun formatore'}`
      : `${progettiMap.get(corso.project_id)?.school_name ?? '—'} — ${corso.title ?? '—'} — ${fmt?.nome ?? 'Nessun formatore'}`
    ws2HeaderRows.push(ws2Rows.length)
    ws2Rows.push([titolo, statoCalendario(corso), '', '', '', ''])
    sessCorso.forEach((s, idx) => {
      const d = new Date(s.data + 'T00:00:00')
      const statoSess = s.completata ? 'Erogata ✓' : (corso.calendario_confermato ? 'Confermata' : 'In proposta')
      if (idx % 2 === 1) ws2AltRows.push(ws2Rows.length)
      ws2Rows.push([formatData(s.data), giorni[d.getDay()], s.ora_inizio ?? '—', s.ora_fine ?? '—', Number(s.ore), statoSess])
    })
    ws2Rows.push(['', '', '', '', '', ''])
  }

  const ws2 = XLSX.utils.aoa_to_sheet(ws2Rows)
  ws2['!cols'] = [{ wch: 60 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 16 }]
  const hFill2 = { patternType: 'solid', fgColor: { rgb: '404040' } }
  const hFont2 = { bold: true, color: { rgb: 'FFFFFF' } }
  const altFill = { patternType: 'solid', fgColor: { rgb: 'F5F5F5' } }
  for (const ri of ws2HeaderRows) {
    for (let ci = 0; ci < 6; ci++) {
      const ref = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (!ws2[ref]) ws2[ref] = { t: 's', v: '' }
      ws2[ref].s = { fill: hFill2, font: hFont2 }
    }
  }
  for (const ri of ws2AltRows) {
    for (let ci = 0; ci < 6; ci++) {
      const ref = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (!ws2[ref]) ws2[ref] = { t: 's', v: '' }
      ws2[ref].s = { fill: altFill }
    }
  }
  XLSX.utils.book_append_sheet(wb, ws2, 'Dettaglio sessioni')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true })
  const today = new Date().toISOString().slice(0, 10)
  const filename = projectId
    ? `Calendari_${(progettiMap.get(projectId)?.school_name ?? 'progetto').replace(/[^a-zA-Z0-9À-ÿ]/g, '_')}_${today}.xlsx`
    : `Calendari_tutti_${today}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
