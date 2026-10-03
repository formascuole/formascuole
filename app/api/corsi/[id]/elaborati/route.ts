import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/corsi/[id]/elaborati — list elaborati with signed URLs (admin, no-auth via admin client)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('elaborati_partecipanti')
    .select('*')
    .eq('corso_id', id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = { id: string; url: string; [k: string]: unknown }
  // Generate signed URLs for each stored file
  const elaborati = await Promise.all((data ?? [] as Row[]).map(async (e: Row) => {
    if ((e.url as string).startsWith('http')) return e
    const { data: signed } = await admin.storage
      .from('elaborati-partecipanti')
      .createSignedUrl(e.url as string, 3600)
    return { ...e, signed_url: signed?.signedUrl ?? null }
  }))

  return NextResponse.json(elaborati)
}

// POST /api/corsi/[id]/elaborati — upload elaborato from participant (no auth required)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let partecipante_nome: string
  let partecipante_cognome: string
  let partecipante_email: string
  let nome_file: string
  let fileBuffer: Uint8Array | null = null
  let fileType: string | null = null
  let urlDirecto: string | null = null

  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    partecipante_nome = (formData.get('nome') as string) ?? ''
    partecipante_cognome = (formData.get('cognome') as string) ?? ''
    partecipante_email = (formData.get('email') as string) ?? ''
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File mancante' }, { status: 400 })
    nome_file = `${partecipante_cognome}_${partecipante_nome}_${file.name}`
    fileBuffer = new Uint8Array(await file.arrayBuffer())
    fileType = file.type
  } else {
    const body = await request.json()
    partecipante_nome = body.nome ?? ''
    partecipante_cognome = body.cognome ?? ''
    partecipante_email = body.email ?? ''
    nome_file = body.nome_file ?? ''
    urlDirecto = body.url ?? null
  }

  if (!partecipante_nome?.trim() || !partecipante_cognome?.trim() || !partecipante_email?.trim() || !nome_file?.trim()) {
    return NextResponse.json({ error: 'Dati partecipante incompleti' }, { status: 400 })
  }

  const admin = createAdminClient()

  let storedUrl = urlDirecto ?? ''
  if (fileBuffer) {
    const safeName = nome_file.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${id}/${Date.now()}_${safeName}`
    const { error: uploadErr } = await admin.storage
      .from('elaborati-partecipanti')
      .upload(path, fileBuffer, { contentType: fileType ?? 'application/octet-stream' })
    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    storedUrl = path
  }

  const { data, error } = await admin
    .from('elaborati_partecipanti')
    .insert({
      corso_id: id,
      partecipante_nome: partecipante_nome.trim(),
      partecipante_cognome: partecipante_cognome.trim(),
      partecipante_email: partecipante_email.trim(),
      nome_file: nome_file.trim(),
      url: storedUrl,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
