import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'

// GET /api/export/storico-variazioni?project_id=<id>
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
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch project info
  const { data: progetto } = await admin.from('progetti').select('id, school_name, anno_scolastico').eq('id', projectId).single()

  // Fetch all corsi for the project
  const { data: corsiRaw } = await admin
    .from('corsi')
    .select('id, title')
    .eq('project_id', projectId)
  const corsi: { id: string; title: string }[] = corsiRaw || []
  const corsiIds = corsi.map(c => c.id)
  const corsoTitleMap = new Map(corsi.map(c => [c.id, c.title]))

  if (corsiIds.length === 0) {
    return NextResponse.json({ error: 'Nessun corso trovato per questo progetto' }, { status: 404 })
  }

  // Fetch all session logs
  const { data: logsRaw, error: logsErr } = await admin
    .from('sessioni_log')
    .select('*, utente:profiles!utente_id(id, nome, role)')
    .in('corso_id', corsiIds)
    .order('corso_id')
    .order('created_at', { ascending: false })

  if (logsErr) return NextResponse.json({ error: logsErr.message }, { status: 500 })
  const logs = (logsRaw || []) as Record<string, unknown>[]

  const MOTIV_LABELS: Record<string, string> = {
    richiesta_scuola: 'Richiesta scuola',
    impegno_formatore: 'Impegno formatore',
    causa_forza_maggiore: 'Forza maggiore',
    problemi_tecnici_logistici: 'Problemi tecnici/logistici',
    accordo_reciproco: 'Accordo reciproco',
    altro: 'Altro',
  }
  const TIPO_LABELS: Record<string, string> = {
    creazione: 'Creazione',
    modifica_data: 'Modifica data',
    modifica_ore: 'Modifica ore',
    eliminazione: 'Eliminazione',
  }

  function formatDate(d: string) {
    const dt = new Date(d + 'T00:00:00')
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
  }
  function formatDatetime(iso: string) {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const wb = XLSX.utils.book_new()

  // Foglio 1: Riepilogo per corso
  const header1 = ['Corso', 'N. variazioni', 'N. eliminazioni', 'N. modifiche data', 'N. modifiche ore']
  const byCourse = new Map<string, Record<string, unknown>[]>()
  for (const log of logs) {
    const cid = log.corso_id as string
    if (!byCourse.has(cid)) byCourse.set(cid, [])
    byCourse.get(cid)!.push(log)
  }

  const rows1 = Array.from(byCourse.entries()).map(([cid, cLogs]) => {
    const variazioni = cLogs.filter(l => l.tipo_modifica !== 'creazione')
    return [
      corsoTitleMap.get(cid) ?? cid,
      variazioni.length,
      cLogs.filter(l => l.tipo_modifica === 'eliminazione').length,
      cLogs.filter(l => l.tipo_modifica === 'modifica_data').length,
      cLogs.filter(l => l.tipo_modifica === 'modifica_ore').length,
    ]
  })

  const ws1 = XLSX.utils.aoa_to_sheet([header1, ...rows1])
  ws1['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }]
  const hFill = { patternType: 'solid', fgColor: { rgb: '2D3748' } }
  const hFont = { bold: true, color: { rgb: 'FFFFFF' } }
  for (let ci = 0; ci < header1.length; ci++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci })
    if (!ws1[ref]) ws1[ref] = { t: 's', v: '' }
    ws1[ref].s = { fill: hFill, font: hFont }
  }
  XLSX.utils.book_append_sheet(wb, ws1, 'Riepilogo per corso')

  // Foglio 2: Dettaglio variazioni
  const header2 = ['Corso', 'Tipo modifica', 'Data precedente', 'Data nuova', 'Ore precedenti', 'Ore nuove', 'Motivazione', 'Dettaglio', 'Operatore', 'Data operazione']
  const rows2: unknown[][] = []
  const headerRows2: number[] = []
  const altRows2: number[] = []

  for (const [cid, cLogs] of byCourse.entries()) {
    const title = corsoTitleMap.get(cid) ?? cid
    headerRows2.push(rows2.length)
    rows2.push([title, '', '', '', '', '', '', '', '', ''])

    let idx = 0
    for (const log of cLogs) {
      if (idx % 2 === 1) altRows2.push(rows2.length)
      const utente = log.utente as { nome?: string } | null
      rows2.push([
        '',
        TIPO_LABELS[log.tipo_modifica as string] ?? (log.tipo_modifica as string),
        log.data_precedente ? formatDate(log.data_precedente as string) : '—',
        log.data_nuova ? formatDate(log.data_nuova as string) : '—',
        log.ore_precedenti != null ? log.ore_precedenti : '—',
        log.ore_nuove != null ? log.ore_nuove : '—',
        log.motivazione_categoria ? (MOTIV_LABELS[log.motivazione_categoria as string] ?? log.motivazione_categoria) : '—',
        (log.motivazione_dettaglio as string) || '—',
        utente?.nome ?? '—',
        formatDatetime(log.created_at as string),
      ])
      idx++
    }
    rows2.push(['', '', '', '', '', '', '', '', '', ''])
  }

  const ws2 = XLSX.utils.aoa_to_sheet([header2, ...rows2])
  ws2['!cols'] = [{ wch: 36 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 26 }, { wch: 40 }, { wch: 22 }, { wch: 18 }]
  const hFill2 = { patternType: 'solid', fgColor: { rgb: '2D3748' } }
  const hFont2 = { bold: true, color: { rgb: 'FFFFFF' } }
  const courseFill = { patternType: 'solid', fgColor: { rgb: '404040' } }
  const courseFont = { bold: true, color: { rgb: 'FFFFFF' } }
  const altFill = { patternType: 'solid', fgColor: { rgb: 'F5F5F5' } }

  for (let ci = 0; ci < header2.length; ci++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci })
    if (!ws2[ref]) ws2[ref] = { t: 's', v: '' }
    ws2[ref].s = { fill: hFill2, font: hFont2 }
  }
  // +1 offset because header2 is row 0, rows2 start at row 1
  for (const ri of headerRows2) {
    for (let ci = 0; ci < header2.length; ci++) {
      const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci })
      if (!ws2[ref]) ws2[ref] = { t: 's', v: '' }
      ws2[ref].s = { fill: courseFill, font: courseFont }
    }
  }
  for (const ri of altRows2) {
    for (let ci = 0; ci < header2.length; ci++) {
      const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci })
      if (!ws2[ref]) ws2[ref] = { t: 's', v: '' }
      if (!ws2[ref].s?.fill) ws2[ref].s = { fill: altFill }
    }
  }
  XLSX.utils.book_append_sheet(wb, ws2, 'Dettaglio variazioni')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true })
  const today = new Date().toISOString().slice(0, 10)
  const schoolSlug = (progetto?.school_name ?? 'progetto').replace(/[^a-zA-Z0-9À-ÿ]/g, '_')
  const filename = `Storico_variazioni_${schoolSlug}_${today}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
