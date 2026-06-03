import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(callerProfile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: targetProfile } = await admin.from('profiles').select('nome, email').eq('id', id).single()
  if (!targetProfile) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })

  const newPassword = generatePassword()

  const { error: pwError } = await admin.auth.admin.updateUserById(id, { password: newPassword })
  if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.formascuole.it'
  const body = `Gentile ${targetProfile.nome},

le tue credenziali di accesso alla piattaforma Formascuole sono state aggiornate.

Email: ${targetProfile.email}
Password temporanea: ${newPassword}

Accedi qui: ${appUrl}

Ti consigliamo di cambiare la password al primo accesso dalla sezione "Il mio account".

Grazie,
Il team Formascuole`

  await sendEmail({
    to: targetProfile.email,
    subject: 'Accesso alla piattaforma Formascuole — nuove credenziali',
    body,
    actions: [{ label: 'Accedi alla piattaforma', url: appUrl, primary: true }],
  })

  return NextResponse.json({ success: true })
}
