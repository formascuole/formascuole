import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/audit-log?tabella=corsi&record_id=xxx&limit=50
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Solo admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const tabella   = searchParams.get('tabella')
  const record_id = searchParams.get('record_id')
  const limit     = Math.min(Number(searchParams.get('limit') || '100'), 500)

  const admin = createAdminClient()
  let query = admin
    .from('audit_log')
    .select('id, created_at, tabella, record_id, operazione, utente_id, old_data, new_data, autore:profiles!audit_log_utente_id_fkey(nome)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (tabella)   query = query.eq('tabella', tabella)
  if (record_id) query = query.eq('record_id', record_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}
