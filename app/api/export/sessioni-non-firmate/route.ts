import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'

// GET /api/export/sessioni-non-firmate
// Excel export di tutte le sessioni passate non firmate
export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const admin = createAdminClient()

  const { data: sessioniRaw, error } = await admin
    .from('sessioni')
    .select(`
      id, data, ora_inizio, ore,
      corsi!corso_id(
        id, title, corso_completato,
        profiles!formatore_id(id, nome, email),
        progetti!project_id(id, school_name, anno_scolastico)
      )
    `)
    .lt('data', today)
    .or('completata.is.null,completata.eq.false')
    .order('data', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type RawS = {
    id: string; data: string; ora_inizio: string | null; ore: number
    corsi: { id: string; title: string; corso_completato: boolean | null; profiles: { nome: string; email: string } | null; progetti: { school_name: string; anno_scolastico: string | null } | null } | null
  }
  const rows = ((sessioniRaw || []) as unknown as RawS[]).filter(s => !s.corsi?.corso_completato)

  function fmtData(d: string) {
    const dt = new Date(d + 'T00:00:00')
    const giorni = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
    return `${giorni[dt.getDay()]} ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
  }
  function fmtOra(t: string | null) { return t ? t.slice(0, 5) : '—' }

  const wb = XLSX.utils.book_new()

  // Foglio 1: Riepilogo per scuola/corso
  const header1 = ['Scuola', 'Anno scolastico', 'Corso', 'Formatore', 'Email formatore', 'N. sessioni non firmate', 'Ore totali da firmare']
  const byKey = new Map<string, { scuola: string; anno: string; corso: string; formatore: string; email: string; nSess: number; ore: number }>()

  for (const s of rows) {
    const key = `${s.corsi?.progetti?.school_name ?? ''}||${s.corsi?.id ?? ''}`
    if (!byKey.has(key)) {
      byKey.set(key, {
        scuola: s.corsi?.progetti?.school_name ?? '—',
        anno: s.corsi?.progetti?.anno_scolastico ?? '—',
        corso: s.corsi?.title ?? '—',
        formatore: s.corsi?.profiles?.nome ?? '—',
        email: s.corsi?.profiles?.email ?? '—',
        nSess: 0,
        ore: 0,
      })
    }
    const r = byKey.get(key)!
    r.nSess++
    r.ore += Number(s.ore)
  }

  const rows1 = Array.from(byKey.values())
    .sort((a, b) => a.scuola.localeCompare(b.scuola) || a.corso.localeCompare(b.corso))
    .map(r => [r.scuola, r.anno, r.corso, r.formatore, r.email, r.nSess, r.ore])

  const ws1 = XLSX.utils.aoa_to_sheet([header1, ...rows1])
  ws1['!cols'] = [{ wch: 36 }, { wch: 16 }, { wch: 44 }, { wch: 24 }, { wch: 28 }, { wch: 22 }, { wch: 22 }]
  const hFill = { patternType: 'solid', fgColor: { rgb: '2D3748' } }
  const hFont = { bold: true, color: { rgb: 'FFFFFF' } }
  for (let ci = 0; ci < header1.length; ci++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci })
    if (!ws1[ref]) ws1[ref] = { t: 's', v: '' }
    ws1[ref].s = { fill: hFill, font: hFont }
  }
  XLSX.utils.book_append_sheet(wb, ws1, 'Riepilogo per corso')

  // Foglio 2: Dettaglio sessioni
  const header2 = ['Scuola', 'Corso', 'Formatore', 'Email formatore', 'Data sessione', 'Orario', 'Ore']
  const altFill = { patternType: 'solid', fgColor: { rgb: 'FFF7ED' } }  // orange-50
  const altRows: number[] = []

  // Raggruppa per scuola→corso, intestazione corso come riga header
  type Group = { scuola: string; corso: string; formatore: string; email: string; sessioni: { data: string; ora: string; ore: number }[] }
  const groups = new Map<string, Group>()
  for (const s of rows) {
    const key = `${s.corsi?.progetti?.school_name ?? ''}||${s.corsi?.id ?? ''}`
    if (!groups.has(key)) {
      groups.set(key, {
        scuola: s.corsi?.progetti?.school_name ?? '—',
        corso: s.corsi?.title ?? '—',
        formatore: s.corsi?.profiles?.nome ?? '—',
        email: s.corsi?.profiles?.email ?? '—',
        sessioni: [],
      })
    }
    groups.get(key)!.sessioni.push({ data: fmtData(s.data), ora: fmtOra(s.ora_inizio), ore: Number(s.ore) })
  }

  const dataRows2: unknown[][] = []
  const headerRows2: number[] = []
  for (const g of Array.from(groups.values()).sort((a, b) => a.scuola.localeCompare(b.scuola) || a.corso.localeCompare(b.corso))) {
    headerRows2.push(dataRows2.length)
    dataRows2.push([g.scuola, g.corso, g.formatore, g.email, '', '', ''])
    g.sessioni.forEach((s, idx) => {
      if (idx % 2 === 1) altRows.push(dataRows2.length)
      dataRows2.push(['', '', '', '', s.data, s.ora, s.ore])
    })
    dataRows2.push(['', '', '', '', '', '', ''])
  }

  const ws2 = XLSX.utils.aoa_to_sheet([header2, ...dataRows2])
  ws2['!cols'] = [{ wch: 34 }, { wch: 44 }, { wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 6 }]
  const hFill2 = { patternType: 'solid', fgColor: { rgb: '2D3748' } }
  const hFont2 = { bold: true, color: { rgb: 'FFFFFF' } }
  const courseFill = { patternType: 'solid', fgColor: { rgb: 'EA580C' } }  // orange-600
  const courseFont = { bold: true, color: { rgb: 'FFFFFF' } }

  for (let ci = 0; ci < header2.length; ci++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci })
    if (!ws2[ref]) ws2[ref] = { t: 's', v: '' }
    ws2[ref].s = { fill: hFill2, font: hFont2 }
  }
  for (const ri of headerRows2) {
    for (let ci = 0; ci < header2.length; ci++) {
      const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci })
      if (!ws2[ref]) ws2[ref] = { t: 's', v: '' }
      ws2[ref].s = { fill: courseFill, font: courseFont }
    }
  }
  for (const ri of altRows) {
    for (let ci = 0; ci < header2.length; ci++) {
      const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci })
      if (!ws2[ref]) ws2[ref] = { t: 's', v: '' }
      if (!ws2[ref].s?.fill) ws2[ref].s = { fill: altFill }
    }
  }
  XLSX.utils.book_append_sheet(wb, ws2, 'Dettaglio sessioni')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true })
  const filename = `Sessioni_non_firmate_${today}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
