import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  // 1. Auth via session cookie (regular client)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Fetch data bypassing RLS with service role
  const admin = createAdminClient()

  const { data: corsi, error } = await admin
    .from('corsi_con_ore')
    .select('*, progetti(id,school_name,address,anno_scolastico,ref_name,ref_email,ref_tel,finanziamento_id), formatore:profiles!formatore_id(id,nome,email,avatar_initials)')
    .eq('tutor_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 3. Batch-fetch referenti specifici dei corsi
  const referenteIds = [...new Set(
    (corsi || []).filter(c => c.referente_id).map(c => c.referente_id as string)
  )]
  const referentiMap = new Map<string, { id: string; nome: string; email: string; tel?: string }>()
  if (referenteIds.length > 0) {
    const { data: referenti } = await admin
      .from('referenti_progetto')
      .select('id,nome,email,tel')
      .in('id', referenteIds)
    for (const r of referenti || []) referentiMap.set(r.id, r)
  }

  const result = (corsi || []).map(c => ({
    ...c,
    referente: c.referente_id ? (referentiMap.get(c.referente_id) ?? null) : null,
  }))

  return NextResponse.json(result)
}
