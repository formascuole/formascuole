import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Formascuole <info@formascuole.it>'
const REPLY_TO = 'info@formascuole.it'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

// ── Auth helper ───────────────────────────────────────────────────────────────
async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) return null
  return user
}

// ── Build HTML email ──────────────────────────────────────────────────────────
function buildHtml(oggetto: string, corpo: string, ctaUrl?: string, ctaLabel?: string) {
  const corpoHtml = corpo
    .split('\n')
    .map(l => l.trim() ? `<p style="margin:0 0 12px 0;line-height:1.6">${l}</p>` : '<br/>')
    .join('')

  const ctaBlock = ctaUrl ? `
    <div style="text-align:center;margin:28px 0">
      <a href="${ctaUrl}"
         style="display:inline-block;background:#d64b55;color:#fff;font-weight:600;font-size:14px;
                padding:12px 28px;border-radius:8px;text-decoration:none">
        ${ctaLabel ?? 'Accedi alla piattaforma →'}
      </a>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5">
        <!-- Header -->
        <tr><td style="background:#d64b55;padding:24px 32px">
          <img src="https://www.formascuole.it/wp-content/uploads/2024/01/logo-formascuole-black-red-flag-2048x361.png"
               alt="Formascuole" height="36" style="display:block"/>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 20px 0;font-size:20px;color:#111;font-weight:700">${oggetto}</h2>
          ${corpoHtml}
          ${ctaBlock}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #f0f0f0">
          <p style="margin:0;font-size:12px;color:#999;line-height:1.5">
            Questa email è stata inviata dalla <strong>Piattaforma Formascuole</strong>.<br/>
            Per assistenza scrivi a <a href="mailto:info@formascuole.it" style="color:#d64b55">info@formascuole.it</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── GET destinatari anteprima ─────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await requireAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const tipologia = searchParams.get('tipologia')
  const progetto_id = searchParams.get('progetto_id')

  const admin = createAdminClient()
  let destinatari: { email: string; nome: string; progetto_id?: string }[] = []

  if (tipologia === 'tutti') {
    const { data } = await admin
      .from('profiles')
      .select('nome, email, role')
      .not('role', 'in', '("admin","super_admin")')
      .not('email', 'is', null)
    destinatari = (data ?? []).map(p => ({ email: p.email, nome: p.nome ?? '' }))

  } else if (tipologia === 'admin') {
    const { data } = await admin
      .from('profiles')
      .select('nome, email')
      .in('role', ['admin', 'super_admin'])
      .not('email', 'is', null)
    destinatari = (data ?? []).map(p => ({ email: p.email, nome: p.nome ?? '' }))

  } else if (tipologia === 'progetto' && progetto_id) {
    // Formatori e tutor assegnati a corsi del progetto
    const { data: corsi } = await admin.from('corsi').select('id').eq('project_id', progetto_id)
    const corsiIds = (corsi ?? []).map(c => c.id)
    if (corsiIds.length > 0) {
      const { data: candidature } = await admin
        .from('candidature_corsi')
        .select('profiles(nome, email)')
        .in('corso_id', corsiIds)
        .eq('stato', 'accettata')
      destinatari = (candidature ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => c.profiles)
        .filter(Boolean)
        .map((p: { nome?: string; email: string }) => ({
          email: p.email,
          nome: p.nome ?? '',
          progetto_id,
        }))
      // Deduplica per email
      const seen = new Set<string>()
      destinatari = destinatari.filter(d => { if (seen.has(d.email)) return false; seen.add(d.email); return true })
    }

  } else if (tipologia === 'ore_non_firmate') {
    // Sessioni passate non ancora confermate (completata = false o null)
    // escludendo corsi già completamente erogati — stessa logica di /api/admin/sessioni-non-firmate
    const today = new Date().toISOString().slice(0, 10)
    const { data: sessioni, error: sessErr } = await admin
      .from('sessioni')
      .select(`
        id,
        corsi!corso_id(
          id, title, corso_completato, project_id,
          profiles!formatore_id(id, nome, email),
          progetti!project_id(id, school_name)
        )
      `)
      .lt('data', today)
      .or('completata.is.null,completata.eq.false')

    console.log('[ore_non_firmate] today:', today, 'sessioni count:', sessioni?.length ?? 0, 'error:', sessErr?.message)
    if (sessioni && sessioni.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sample = sessioni[0] as any
      console.log('[ore_non_firmate] sample[0]:', JSON.stringify(sample).slice(0, 300))
    }

    // Raggruppa per progetto + formatore per evitare email duplicate
    const grouped = new Map<string, { email: string; nome: string; progetto_id: string; corso: string; scuola: string }>()
    for (const s of sessioni ?? []) {
      // Supabase può restituire join come array — normalizziamo sempre
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const corsiRaw = s.corsi as any
      const corsi = Array.isArray(corsiRaw) ? corsiRaw[0] : corsiRaw
      if (!corsi) continue
      if (corsi?.corso_completato) continue  // escludi corsi completati
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fmtRaw = corsi?.profiles as any
      const fmt = Array.isArray(fmtRaw) ? fmtRaw[0] : fmtRaw
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const progettoRaw = corsi?.progetti as any
      const progetto = Array.isArray(progettoRaw) ? progettoRaw[0] : progettoRaw
      if (!fmt?.email) continue
      const pid = corsi?.project_id ?? progetto?.id ?? ''
      const key = `${fmt.email}::${pid}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          email: fmt.email,
          nome: fmt.nome ?? '',
          progetto_id: pid,
          corso: corsi?.title ?? '',
          scuola: progetto?.school_name ?? '',
        })
      }
    }
    destinatari = [...grouped.values()]
  }

  return NextResponse.json(destinatari)
}

// ── POST invia ────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await requireAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const tipologia = formData.get('tipologia') as string
  const progetto_id = (formData.get('progetto_id') as string) || undefined
  const oggetto = formData.get('oggetto') as string
  const corpo = formData.get('corpo') as string
  const allegatiFiles = formData.getAll('allegati') as File[]

  if (!tipologia || !oggetto?.trim() || !corpo?.trim()) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Converte allegati in base64 per Resend
  const attachments: { filename: string; content: string }[] = []
  for (const file of allegatiFiles) {
    if (file.size === 0) continue
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    bytes.forEach(b => { binary += String.fromCharCode(b) })
    attachments.push({
      filename: file.name,
      content: btoa(binary),
    })
  }

  // Recupera destinatari (riusa la stessa logica GET)
  const url = new URL(request.url)
  url.searchParams.set('tipologia', tipologia)
  if (progetto_id) url.searchParams.set('progetto_id', progetto_id)
  const getRes = await GET(new NextRequest(url.toString(), { headers: request.headers }))
  const destinatari = await getRes.json() as { email: string; nome: string; progetto_id?: string }[]

  if (!destinatari.length) {
    return NextResponse.json({ error: 'Nessun destinatario trovato' }, { status: 400 })
  }

  const admin = createAdminClient()
  let n_inviati = 0
  let n_errori = 0

  // Invia in batch da 50 (limite Resend)
  for (let i = 0; i < destinatari.length; i += 50) {
    const batch = destinatari.slice(i, i + 50)
    await Promise.all(batch.map(async (d) => {
      // Per ore_non_firmate costruiamo il link al progetto
      let ctaUrl: string | undefined
      let ctaLabel: string | undefined
      if (tipologia === 'ore_non_firmate' && d.progetto_id) {
        ctaUrl = `${APP_URL}/formatore/progetti/${d.progetto_id}`
        ctaLabel = 'Firma le tue ore →'
      }

      // Personalizza il corpo con il nome del destinatario
      const corpoPersonalizzato = corpo.replace(/\[Nome Cognome\]/g, d.nome || 'Gentile utente')

      try {
        await resend.emails.send({
          from: FROM,
          to: d.email,
          replyTo: REPLY_TO,
          subject: oggetto,
          html: buildHtml(oggetto, corpoPersonalizzato, ctaUrl, ctaLabel),
          ...(attachments.length > 0 ? { attachments } : {}),
        })
        n_inviati++
      } catch {
        n_errori++
      }
    }))
  }

  // Salva log
  await admin.from('comunicazioni_log').insert({
    inviata_da: user.id,
    tipologia,
    progetto_id: progetto_id ?? null,
    oggetto,
    corpo,
    destinatari: destinatari.map(d => ({ email: d.email, nome: d.nome })),
    n_inviati,
    n_errori,
  })

  return NextResponse.json({ n_inviati, n_errori })
}
