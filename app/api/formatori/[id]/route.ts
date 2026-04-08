import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { UserRole } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/auth'

const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller is admin-level
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const callerRole: UserRole | undefined = callerProfile?.role
  if (!callerRole || !ADMIN_ROLES.includes(callerRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Load target user
  const adminClient = createAdminClient()
  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('id, nome, email, role')
    .eq('id', targetId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
  }

  // Protect super_admin accounts — nobody can edit them via this endpoint
  if (targetProfile.role === 'super_admin') {
    return NextResponse.json({ error: 'Non è possibile modificare un account Super Admin' }, { status: 403 })
  }
  // Also check profiles_roles for super_admin
  const { data: targetSuperAdminRow } = await adminClient
    .from('profiles_roles')
    .select('role')
    .eq('profile_id', targetId)
    .eq('role', 'super_admin')
    .maybeSingle()
  if (targetSuperAdminRow) {
    return NextResponse.json({ error: 'Non è possibile modificare un account Super Admin' }, { status: 403 })
  }

  const body = await request.json()
  const { nome, roles } = body

  if (!nome?.trim()) {
    return NextResponse.json({ error: 'Il nome è obbligatorio' }, { status: 400 })
  }
  if (!Array.isArray(roles) || roles.length === 0) {
    return NextResponse.json({ error: 'Seleziona almeno un ruolo' }, { status: 400 })
  }

  const validRoles: UserRole[] = ['formatore', 'tutor', 'admin']
  for (const r of roles as UserRole[]) {
    if (!validRoles.includes(r)) {
      return NextResponse.json({ error: `Ruolo non valido: ${r}` }, { status: 400 })
    }
  }

  // Only super_admin can assign admin role
  const callerIsSuperAdmin = await checkIsSuperAdmin(user.id)
  if ((roles as UserRole[]).includes('admin') && !callerIsSuperAdmin) {
    return NextResponse.json({ error: 'Solo il Super Admin può assegnare il ruolo Admin' }, { status: 403 })
  }

  // Determine new primary role (highest priority)
  const newPrimaryRole: UserRole = (roles as UserRole[]).includes('admin') ? 'admin'
    : (roles as UserRole[]).includes('formatore') ? 'formatore'
    : 'tutor'

  const newNome = nome.trim()
  const newAvatarInitials = newNome
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Get current roles to detect what was added
  const { data: existingRoles } = await adminClient
    .from('profiles_roles')
    .select('role')
    .eq('profile_id', targetId)

  const previousRoles = new Set((existingRoles || []).map(r => r.role as UserRole))
  const addedRoles = (roles as UserRole[]).filter(r => !previousRoles.has(r))

  // Update profiles
  const { data: updatedProfile, error: updateError } = await adminClient
    .from('profiles')
    .update({
      nome: newNome,
      avatar_initials: newAvatarInitials,
      role: newPrimaryRole,
    })
    .eq('id', targetId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Replace all roles in profiles_roles: delete then re-insert
  await adminClient.from('profiles_roles').delete().eq('profile_id', targetId)

  const roleRows = (roles as UserRole[]).map(r => ({ profile_id: targetId, role: r }))
  const { error: rolesError } = await adminClient
    .from('profiles_roles')
    .insert(roleRows)

  if (rolesError) {
    console.error('profiles_roles update failed:', rolesError)
  }

  // Send notification email if new roles were added
  if (addedRoles.length > 0) {
    const roleLabels = (roles as UserRole[]).map(r => ROLE_LABELS[r]).join(', ')
    const addedLabels = addedRoles.map(r => ROLE_LABELS[r]).join(', ')
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

    const body = `Gentile ${newNome},

i tuoi ruoli sulla piattaforma Formascuole sono stati aggiornati.

Ruoli ora assegnati: ${roleLabels}
Ruoli aggiunti: ${addedLabels}

Puoi accedere alla piattaforma al seguente link:
${APP_URL}

Per qualsiasi domanda, contatta il tuo amministratore.

Cordiali saluti,
Il team Formascuole`

    try {
      await sendEmail({
        to: targetProfile.email,
        subject: `Formascuole — Ruoli aggiornati: ${addedLabels}`,
        body,
      })
    } catch (err) {
      console.error('Role update email failed (non-fatal):', err)
    }
  }

  return NextResponse.json({ ...updatedProfile, roles })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only super_admin can delete users
  if (!await checkIsSuperAdmin(user.id)) {
    return NextResponse.json({ error: 'Riservato al Super Admin' }, { status: 403 })
  }

  // Cannot delete yourself
  if (targetId === user.id) {
    return NextResponse.json({ error: 'Non puoi eliminare il tuo stesso account' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Cannot delete other super_admins
  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', targetId)
    .single()
  if (!targetProfile) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
  if (targetProfile.role === 'super_admin') {
    return NextResponse.json({ error: 'Non è possibile eliminare un altro Super Admin' }, { status: 403 })
  }
  const { data: superAdminRow } = await adminClient
    .from('profiles_roles')
    .select('role')
    .eq('profile_id', targetId)
    .eq('role', 'super_admin')
    .maybeSingle()
  if (superAdminRow) {
    return NextResponse.json({ error: 'Non è possibile eliminare un altro Super Admin' }, { status: 403 })
  }

  // Nullify references in corsi
  await adminClient.from('corsi').update({ formatore_id: null }).eq('formatore_id', targetId)
  await adminClient.from('corsi').update({ tutor_id: null }).eq('tutor_id', targetId)

  // Delete roles, profile, auth user
  await adminClient.from('profiles_roles').delete().eq('profile_id', targetId)
  await adminClient.from('profiles').delete().eq('id', targetId)
  const { error: authError } = await adminClient.auth.admin.deleteUser(targetId)
  if (authError) {
    console.error('Auth delete error (non-fatal):', authError)
  }

  return NextResponse.json({ success: true })
}
