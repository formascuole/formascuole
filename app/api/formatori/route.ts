import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { sendEmail, generateBenvenutoEmail, generateAdminBenvenutoEmail } from '@/lib/email'
import { UserRole } from '@/lib/types'

const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!ADMIN_ROLES.includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['formatore', 'tutor', 'admin'])
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const callerRole: UserRole | undefined = callerProfile?.role
  if (!callerRole || !ADMIN_ROLES.includes(callerRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { nome, email, password, roles } = body

  // Validate required fields
  if (!nome || !email || !password) {
    return NextResponse.json({ error: 'Nome, email e password sono obbligatori' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La password deve essere di almeno 6 caratteri' }, { status: 400 })
  }

  // Determine roles to assign (defaults to formatore if not provided)
  const requestedRoles: UserRole[] = Array.isArray(roles) && roles.length > 0
    ? roles
    : ['formatore']

  // Validate requested roles are valid
  const validRoles: UserRole[] = ['formatore', 'tutor', 'admin', 'super_admin']
  for (const r of requestedRoles) {
    if (!validRoles.includes(r)) {
      return NextResponse.json({ error: `Ruolo non valido: ${r}` }, { status: 400 })
    }
  }

  // Only super_admin can create admin accounts
  if (requestedRoles.includes('admin') && !await checkIsSuperAdmin(user.id)) {
    return NextResponse.json({ error: 'Solo il Super Admin può creare account Admin' }, { status: 403 })
  }
  // Nobody can create super_admin accounts via UI
  if (requestedRoles.includes('super_admin')) {
    return NextResponse.json({ error: 'Non è possibile creare account Super Admin' }, { status: 403 })
  }

  // The "primary" role stored in profiles.role (highest priority)
  const primaryRole: UserRole = requestedRoles.includes('admin') ? 'admin'
    : requestedRoles.includes('formatore') ? 'formatore'
    : requestedRoles.includes('tutor') ? 'tutor'
    : requestedRoles[0]

  const adminClient = createAdminClient()

  const avatarInitials = nome
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nome,
      role: primaryRole,
      avatar_initials: avatarInitials,
    },
  })

  if (authError) {
    const msg = authError.message
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      return NextResponse.json({ error: 'Esiste già un account con questa email' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (!newUser.user) {
    return NextResponse.json({ error: 'Errore nella creazione utente' }, { status: 500 })
  }

  // Upsert profile with primary role
  const { data: profileData, error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: newUser.user.id,
      role: primaryRole,
      nome,
      email,
      avatar_initials: avatarInitials,
    })
    .select()
    .single()

  if (profileError) {
    await adminClient.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json(
      { error: 'Errore nella creazione del profilo: ' + profileError.message },
      { status: 500 }
    )
  }

  // Insert all requested roles into profiles_roles
  const roleRows = requestedRoles.map(r => ({ profile_id: newUser.user!.id, role: r }))
  const { error: rolesError } = await adminClient
    .from('profiles_roles')
    .upsert(roleRows, { onConflict: 'profile_id,role' })

  if (rolesError) {
    console.error('profiles_roles insert failed (non-fatal):', rolesError)
  }

  // Send welcome email (non-blocking)
  try {
    const isAdminUser = primaryRole === 'admin'
    await sendEmail({
      to: email,
      subject: isAdminUser
        ? 'Benvenuto in Formascuole — Accesso alla piattaforma'
        : 'Benvenuto in Formascuole — Le tue credenziali di accesso',
      body: isAdminUser
        ? generateAdminBenvenutoEmail({ nome, email, password })
        : generateBenvenutoEmail({ nome, email, password }),
    })
  } catch (emailErr) {
    console.error('Welcome email failed (non-fatal):', emailErr)
  }

  return NextResponse.json(profileData, { status: 201 })
}
