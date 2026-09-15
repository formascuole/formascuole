import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!callerProfile || !['admin', 'super_admin'].includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Riservato agli amministratori' }, { status: 403 })
  }

  if (targetId === user.id) {
    return NextResponse.json({ error: 'Non puoi eliminare il tuo stesso account' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', targetId)
    .single()
  if (!targetProfile) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
  if (targetProfile.role === 'super_admin') {
    return NextResponse.json({ error: 'Non è possibile eliminare un account Super Admin' }, { status: 403 })
  }
  const { data: superAdminRow } = await adminClient
    .from('profiles_roles')
    .select('role')
    .eq('profile_id', targetId)
    .eq('role', 'super_admin')
    .maybeSingle()
  if (superAdminRow) {
    return NextResponse.json({ error: 'Non è possibile eliminare un account Super Admin' }, { status: 403 })
  }

  // Safety check: no accepted courses
  const { count } = await adminClient
    .from('corsi')
    .select('*', { count: 'exact', head: true })
    .eq('formatore_id', targetId)
    .eq('stato_assegnazione', 'accettato')
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `Impossibile eliminare l'utente — ha ${count} ${count === 1 ? 'corso accettato attivo' : 'corsi accettati attivi'}.` },
      { status: 422 }
    )
  }

  const { error: authError } = await adminClient.auth.admin.deleteUser(targetId)
  if (authError) {
    console.error('[utenti/delete] auth error:', authError)
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
