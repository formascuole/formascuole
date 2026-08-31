import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

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

  if (!tipo || !['cv', 'ci', 'cf'].includes(tipo)) {
    return NextResponse.json({ error: 'tipo non valido' }, { status: 400 })
  }
  if (!file) {
    return NextResponse.json({ error: 'File mancante' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File troppo grande (max 2 MB)' }, { status: 400 })
  }

  const contentType = file.type
  if (contentType !== 'application/pdf') {
    return NextResponse.json({ error: 'Solo file PDF accettati' }, { status: 400 })
  }

  const path = `${user.id}/${tipo}.pdf`

  const buffer = Buffer.from(await file.arrayBuffer())
  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('documenti-formatori')
    .upload(path, buffer, { contentType, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage
    .from('documenti-formatori')
    .getPublicUrl(path)

  const now = new Date().toISOString()
  const updatePayload: Record<string, string> =
    tipo === 'cv' ? { cv_url: publicUrl, cv_uploaded_at: now }
    : tipo === 'ci' ? { ci_url: publicUrl, ci_uploaded_at: now }
    :                 { cf_url: publicUrl, cf_uploaded_at: now }

  const { data: updatedProfile } = await admin
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id)
    .select('cv_url, ci_url, cf_url, documenti_completi')
    .single()

  // Mark documenti_completi when all 3 are present
  if (updatedProfile?.cv_url && updatedProfile?.ci_url && updatedProfile?.cf_url && !updatedProfile?.documenti_completi) {
    await admin
      .from('profiles')
      .update({ documenti_completi: true })
      .eq('id', user.id)
  }

  return NextResponse.json({ success: true, path })
}
