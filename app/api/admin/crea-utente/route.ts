import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, generateBenvenutoEmail, generateAdminBenvenutoEmail } from '@/lib/email'
import { UserRole } from '@/lib/types'

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const VALID_ROLES: UserRole[] = ['formatore', 'tutor', 'admin']

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
  if (!callerRole || !['admin', 'super_admin'].includes(callerRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { nome, email, ruolo, tariffa_oraria_formatore, tariffa_oraria_tutor } = body as {
    nome?: string; email?: string; ruolo?: UserRole
    tariffa_oraria_formatore?: number; tariffa_oraria_tutor?: number
  }

  if (!nome?.trim() || !email?.trim() || !ruolo) {
    return NextResponse.json({ error: 'Nome, email e ruolo sono obbligatori' }, { status: 400 })
  }
  if (!VALID_ROLES.includes(ruolo)) {
    return NextResponse.json({ error: `Ruolo non valido: ${ruolo}` }, { status: 400 })
  }
  if (ruolo === 'admin' && callerRole !== 'super_admin') {
    return NextResponse.json({ error: 'Solo il Super Admin può creare account Admin' }, { status: 403 })
  }
  if (ruolo === 'formatore' && (!tariffa_oraria_formatore || tariffa_oraria_formatore <= 0)) {
    return NextResponse.json({ error: 'La tariffa oraria è obbligatoria per formatori e tutor' }, { status: 400 })
  }
  if (ruolo === 'tutor' && (!tariffa_oraria_tutor || tariffa_oraria_tutor <= 0)) {
    return NextResponse.json({ error: 'La tariffa oraria è obbligatoria per formatori e tutor' }, { status: 400 })
  }

  const nomeTrimmed = nome.trim()
  const emailTrimmed = email.trim().toLowerCase()
  const password = generatePassword()
  const avatarInitials = nomeTrimmed
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const admin = createAdminClient()

  // createUser fires handle_new_user trigger. By passing user_metadata with a valid
  // role string, the trigger can always cast it correctly (fixes staging enum issue).
  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email: emailTrimmed,
    password,
    email_confirm: true,
    user_metadata: {
      nome: nomeTrimmed,
      role: ruolo,
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

  const userId = newUser.user.id

  // Belt-and-suspenders: upsert profile even if trigger already created it.
  // This guarantees the profile exists regardless of trigger state on staging.
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: userId, role: ruolo, nome: nomeTrimmed, email: emailTrimmed, avatar_initials: avatarInitials }, { onConflict: 'id' })
  if (profileError) {
    console.error('[crea-utente] profile upsert (non-fatal):', profileError.message)
  }

  const { error: rolesError } = await admin
    .from('profiles_roles')
    .upsert({ profile_id: userId, role: ruolo }, { onConflict: 'profile_id,role' })
  if (rolesError) {
    console.error('[crea-utente] profiles_roles upsert (non-fatal):', rolesError.message)
  }

  // Set tariffa for formatori/tutori
  if (ruolo === 'formatore' || ruolo === 'tutor') {
    const tariffeUpdate: Record<string, number> = {}
    if (ruolo === 'formatore' && tariffa_oraria_formatore) tariffeUpdate.tariffa_oraria_formatore = tariffa_oraria_formatore
    if (ruolo === 'tutor' && tariffa_oraria_tutor) tariffeUpdate.tariffa_oraria_tutor = tariffa_oraria_tutor
    if (Object.keys(tariffeUpdate).length > 0) {
      const { error: tariffaError } = await admin.from('profiles').update(tariffeUpdate).eq('id', userId)
      if (tariffaError) console.error('[crea-utente] tariffa update (non-fatal):', tariffaError.message)
    }
  }

  // Welcome email (non-blocking)
  try {
    await sendEmail({
      to: emailTrimmed,
      subject: ruolo === 'admin'
        ? 'Benvenuto in Formascuole — Accesso alla piattaforma'
        : 'Benvenuto in Formascuole — Le tue credenziali di accesso',
      ...(ruolo === 'admin'
        ? { body: generateAdminBenvenutoEmail({ nome: nomeTrimmed, email: emailTrimmed, password }) }
        : generateBenvenutoEmail({ nome: nomeTrimmed, email: emailTrimmed, password })),
    })
  } catch (err) {
    console.error('[crea-utente] welcome email (non-fatal):', err)
  }

  return NextResponse.json({ success: true, password, userId }, { status: 201 })
}
