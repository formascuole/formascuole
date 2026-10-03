import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'corso-allegati'   // bucket condiviso, path: progetti/{id}/...
const MAX_SIZE_BYTES = 20 * 1024 * 1024
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

// POST /api/progetti/[id]/allegato — upload allegato progetto
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
  const { data: existingProgetto } = await adminClient
    .from('progetti')
    .select('allegato_url')
    .eq('id', id)
    .single()

  if (existingProgetto?.allegato_url) {
    const url = existingProgetto.allegato_url as string
    const marker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx !== -1) {
      const storagePath = url.substring(idx + marker.length)
      await adminClient.storage.from(BUCKET).remove([storagePath])
    }
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `progetti/${id}/${Date.now()}_${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = adminClient.storage.from(BUCKET).getPublicUrl(storagePath)

  const { error: dbError } = await adminClient
    .from('progetti')
    .update({ allegato_url: publicUrl, allegato_nome: file.name })
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ url: publicUrl, nome: file.name })
}

// DELETE /api/progetti/[id]/allegato — rimuovi allegato
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const adminClient = createAdminClient()
  const { data: progetto } = await adminClient
    .from('progetti')
    .select('allegato_url')
    .eq('id', id)
    .single()

  if (progetto?.allegato_url) {
    const url = progetto.allegato_url as string
    const marker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx !== -1) {
      const storagePath = url.substring(idx + marker.length)
      await adminClient.storage.from(BUCKET).remove([storagePath])
    }
  }

  const { error } = await adminClient
    .from('progetti')
    .update({ allegato_url: null, allegato_nome: null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
