import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
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

  const body = await req.json()
  const ids: string[] = Array.isArray(body.ids) ? body.ids : []

  if (ids.length === 0) {
    return NextResponse.json({ error: 'Nessun utente selezionato' }, { status: 400 })
  }
  if (ids.includes(user.id)) {
    return NextResponse.json({ error: 'Non puoi eliminare il tuo stesso account' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Block super_admin targets
  const [{ data: saProfiles }, { data: saRoles }] = await Promise.all([
    adminClient.from('profiles').select('id').eq('role', 'super_admin').in('id', ids),
    adminClient.from('profiles_roles').select('profile_id').eq('role', 'super_admin').in('profile_id', ids),
  ])
  const blockedSA = new Set([
    ...(saProfiles || []).map(p => p.id),
    ...(saRoles || []).map(r => r.profile_id),
  ])
  if (blockedSA.size > 0) {
    return NextResponse.json({ error: 'Non è possibile eliminare account Super Admin' }, { status: 403 })
  }

  // Safety check: block if any selected user has accepted courses
  const { data: acceptedCourses } = await adminClient
    .from('corsi')
    .select('formatore_id')
    .in('formatore_id', ids)
    .eq('stato_assegnazione', 'accettato')

  if (acceptedCourses && acceptedCourses.length > 0) {
    const blockedIds = [...new Set(acceptedCourses.map(c => c.formatore_id as string))]
    const { data: blockedProfiles } = await adminClient
      .from('profiles')
      .select('nome')
      .in('id', blockedIds)
    const nomi = (blockedProfiles || []).map(p => p.nome).join(', ')
    return NextResponse.json(
      {
        error: `Impossibile eliminare — ${blockedIds.length === 1 ? 'il seguente utente ha' : 'i seguenti utenti hanno'} corsi accettati attivi: ${nomi}.`,
      },
      { status: 422 }
    )
  }

  // Delete all
  const failed: string[] = []
  for (const id of ids) {
    const { error } = await adminClient.auth.admin.deleteUser(id)
    if (error) {
      console.error(`[bulk-delete] auth error for ${id}:`, error)
      failed.push(id)
    }
  }

  if (failed.length > 0) {
    return NextResponse.json(
      { error: `Eliminazione parzialmente fallita per ${failed.length} utenti` },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, count: ids.length })
}
