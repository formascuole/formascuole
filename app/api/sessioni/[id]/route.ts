import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sessione } = await supabase.from('sessioni').select('corso_id').eq('id', id).single()
  if (!sessione) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin','super_admin'].includes(profile?.role)) {
    const { data: corso } = await supabase.from('corsi').select('formatore_id').eq('id', sessione.corso_id).single()
    if (corso?.formatore_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { error } = await supabase.from('sessioni').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sessione } = await supabase
    .from('sessioni')
    .select('corso_id, completata')
    .eq('id', id)
    .single()
  if (!sessione) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Permission: admin or the formatore of the corso
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin','super_admin'].includes(profile?.role)) {
    const { data: corso } = await supabase.from('corsi').select('formatore_id').eq('id', sessione.corso_id).single()
    if (corso?.formatore_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await req.json()

  // Only allow marking as completata (not unmarking)
  if (body.completata !== true) {
    return NextResponse.json({ error: 'Can only mark as completata' }, { status: 400 })
  }

  if (sessione.completata) {
    return NextResponse.json({ error: 'Already completata' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sessioni')
    .update({ completata: true, completata_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
