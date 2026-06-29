import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, msg: 'Unauthorized' } as const
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) return { ok: false, status: 403, msg: 'Forbidden' } as const
  return { ok: true } as const
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.msg }, { status: auth.status })

  const admin = createAdminClient()
  const { data, error } = await admin.from('partners').select('*').order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.msg }, { status: auth.status })

  const { nome } = await req.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('partners').insert({ nome: nome.trim() }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
