import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/corsi/[id]/sessioni/[sessioneId]/videoconferenza — save link_videoconferenza
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessioneId: string }> }
) {
  const { id, sessioneId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  const isAdmin = ['admin', 'super_admin'].includes(role)
  const isFormatore = role === 'formatore'
  if (!isAdmin && !isFormatore) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const link = body.link_videoconferenza ?? null

  const admin = createAdminClient()

  // Verify session belongs to the course
  const { data: sessione } = await admin
    .from('sessioni')
    .select('id, corso_id')
    .eq('id', sessioneId)
    .eq('corso_id', id)
    .single()

  if (!sessione) return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })

  const { data, error } = await admin
    .from('sessioni')
    .update({ link_videoconferenza: link?.trim() || null })
    .eq('id', sessioneId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
