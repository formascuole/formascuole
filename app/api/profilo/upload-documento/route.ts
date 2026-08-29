import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

const ALLOWED: Record<string, string[]> = {
  cv: ['application/pdf', 'application/msword',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/vnd.oasis.opendocument.text'],
  ci: ['application/pdf', 'image/jpeg', 'image/png'],
}

const EXT_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['formatore', 'tutor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const tipo = formData.get('tipo') as string
  const file = formData.get('file') as File | null

  if (!tipo || !['cv', 'ci'].includes(tipo)) {
    return NextResponse.json({ error: 'tipo non valido' }, { status: 400 })
  }
  if (!file) {
    return NextResponse.json({ error: 'File mancante' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File troppo grande (max 5 MB)' }, { status: 400 })
  }

  const contentType = file.type
  if (!ALLOWED[tipo].includes(contentType)) {
    return NextResponse.json({ error: `Formato non consentito per ${tipo.toUpperCase()}` }, { status: 400 })
  }

  const ext = EXT_MAP[contentType] ?? 'bin'
  const path = `${user.id}/${tipo}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('documenti-formatori')
    .upload(path, buffer, { contentType, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const now = new Date().toISOString()
  const updatePayload =
    tipo === 'cv'
      ? { cv_url: path, cv_uploaded_at: now }
      : { ci_url: path, ci_uploaded_at: now }

  const { data: updatedProfile } = await admin
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id)
    .select('cv_url, cv_uploaded_at, ci_url, ci_uploaded_at, documenti_completi')
    .single()

  // Mark documenti_completi when both cv_url and ci_url are set
  if (updatedProfile?.cv_url && updatedProfile?.ci_url && !updatedProfile?.documenti_completi) {
    await admin
      .from('profiles')
      .update({ documenti_completi: true })
      .eq('id', user.id)
  }

  return NextResponse.json({ success: true, path })
}
