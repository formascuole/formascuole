import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'corso-allegati'
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
]

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) return { error: 'Forbidden', status: 403 }
  return { user, profile }
}

// POST /api/corsi/[id]/allegato — upload file allegato alle note
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'File mancante' }, { status: 400 })

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File troppo grande (max 20 MB)' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo file non consentito. Usa PDF, Word, Excel o immagini.' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Remove existing allegato if present
  const { data: existingCorso } = await adminClient
    .from('corsi')
    .select('note_allegato_url')
    .eq('id', id)
    .single()

  if (existingCorso?.note_allegato_url) {
    // Extract storage path from URL
    const url = existingCorso.note_allegato_url as string
    const marker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx !== -1) {
      const storagePath = url.substring(idx + marker.length)
      await adminClient.storage.from(BUCKET).remove([storagePath])
    }
  }

  // Build unique storage path
  const ext = file.name.split('.').pop() ?? 'bin'
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${id}/${Date.now()}_${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = adminClient.storage.from(BUCKET).getPublicUrl(storagePath)

  const { error: dbError } = await adminClient
    .from('corsi')
    .update({ note_allegato_url: publicUrl, note_allegato_nome: file.name })
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ url: publicUrl, nome: file.name })
}

// DELETE /api/corsi/[id]/allegato — rimuovi allegato
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const adminClient = createAdminClient()
  const { data: corso } = await adminClient
    .from('corsi')
    .select('note_allegato_url')
    .eq('id', id)
    .single()

  if (corso?.note_allegato_url) {
    const url = corso.note_allegato_url as string
    const marker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx !== -1) {
      const storagePath = url.substring(idx + marker.length)
      await adminClient.storage.from(BUCKET).remove([storagePath])
    }
  }

  const { error } = await adminClient
    .from('corsi')
    .update({ note_allegato_url: null, note_allegato_nome: null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
