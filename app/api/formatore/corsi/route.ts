import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  // 1. Auth via session cookie (regular client)
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  console.log('[/api/formatore/corsi] auth:', { userId: user?.id, authError: authError?.message })

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Fetch data bypassing RLS with service role
  const admin = createAdminClient()

  // Diagnostic: check base corsi table first
  const { data: corsiBase, error: baseError } = await admin
    .from('corsi')
    .select('id, title, formatore_id')

  console.log('[/api/formatore/corsi] ALL corsi in base table:', JSON.stringify(corsiBase))
  console.log('[/api/formatore/corsi] base table error:', baseError?.message)

  const corsiDiQuesto = (corsiBase || []).filter(c => c.formatore_id === user.id)
  console.log(`[/api/formatore/corsi] corsi with formatore_id=${user.id}:`, JSON.stringify(corsiDiQuesto))

  // Main query on the view
  const { data: corsi, error } = await admin
    .from('corsi_con_ore')
    .select('*, progetti(id,school_name,address,anno_scolastico,ref_name,ref_email,ref_tel,finanziamento_id)')
    .eq('formatore_id', user.id)
    .order('created_at')

  console.log('[/api/formatore/corsi] view query result count:', corsi?.length ?? 0)
  console.log('[/api/formatore/corsi] view query error:', error?.message)

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

  // Also include diagnostic info in response headers (readable in browser devtools)
  const res = NextResponse.json(result)
  res.headers.set('X-Debug-UserId', user.id)
  res.headers.set('X-Debug-CoursiCount', String(result.length))
  res.headers.set('X-Debug-AllCorsiIds', JSON.stringify(corsiBase?.map(c => ({ id: c.id, formatore_id: c.formatore_id })) ?? []))
  return res
}
