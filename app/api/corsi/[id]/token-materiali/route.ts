import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTokenMateriali } from '@/lib/token-materiali'

// POST /api/corsi/[id]/token-materiali — generate (or return existing) portal token
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(profile?.role ?? '')
  const isFormatore = profile?.role === 'formatore'
  if (!isAdmin && !isFormatore) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: corso } = await admin
    .from('corsi')
    .select('id, title, token_materiali, project_id')
    .eq('id', id)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })

  if (corso.token_materiali) {
    return NextResponse.json({ token: corso.token_materiali })
  }

  // Fetch school name for slug
  const { data: progetto } = await admin
    .from('progetti')
    .select('school_name')
    .eq('id', corso.project_id)
    .single()

  // Calc scadenza = max(sessioni.data) + 30 days
  const { data: sessioni } = await admin
    .from('sessioni')
    .select('data')
    .eq('corso_id', id)
    .order('data', { ascending: false })
    .limit(1)

  let materiali_scadenza: string | null = null
  if (sessioni && sessioni.length > 0) {
    const lastDate = new Date(sessioni[0].data + 'T00:00:00')
    lastDate.setDate(lastDate.getDate() + 30)
    materiali_scadenza = lastDate.toISOString().slice(0, 10)
  }

  let token = generateTokenMateriali(corso.title, progetto?.school_name ?? '')
  // Retry on collision (extremely rare)
  for (let i = 0; i < 3; i++) {
    const { error } = await admin
      .from('corsi')
      .update({ token_materiali: token, ...(materiali_scadenza ? { materiali_scadenza } : {}) })
      .eq('id', id)
    if (!error) return NextResponse.json({ token, materiali_scadenza })
    token = generateTokenMateriali(corso.title, progetto?.school_name ?? '')
  }

  return NextResponse.json({ error: 'Impossibile generare il token' }, { status: 500 })
}
