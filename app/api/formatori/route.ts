import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'formatore')
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  // Verify the calling user is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { nome, email, password } = body

  if (!nome || !email || !password) {
    return NextResponse.json({ error: 'Nome, email e password sono obbligatori' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La password deve essere di almeno 6 caratteri' }, { status: 400 })
  }

  // Admin client (service role) to create user without email confirmation
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
      role: 'formatore',
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

  // Upsert profile — guarantees correct data even if the DB trigger already ran
  const { data: profileData, error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: newUser.user.id,
      role: 'formatore',
      nome,
      email,
      avatar_initials: avatarInitials,
    })
    .select()
    .single()

  if (profileError) {
    // Clean up the auth user to avoid orphaned accounts
    await adminClient.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json(
      { error: 'Errore nella creazione del profilo: ' + profileError.message },
      { status: 500 }
    )
  }

  return NextResponse.json(profileData, { status: 201 })
}
