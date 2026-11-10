import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const progetto_id = searchParams.get('progetto_id')
  if (!progetto_id) return NextResponse.json({ error: 'progetto_id obbligatorio' }, { status: 400 })

  const { data, error } = await supabase
    .from('chat_messaggi')
    .select('*, autore:profiles(id,nome,avatar_initials)')
    .eq('progetto_id', progetto_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch which messages this user has already read
  const ids = (data || []).map(m => m.id)
  let readSet = new Set<string>()
  if (ids.length > 0) {
    const { data: letture } = await supabase
      .from('chat_letture')
      .select('messaggio_id')
      .eq('utente_id', user.id)
      .in('messaggio_id', ids)
    readSet = new Set((letture || []).map(l => l.messaggio_id))
  }

  const messaggi = (data || []).map(m => ({
    ...m,
    letto: readSet.has(m.id),
  }))

  return NextResponse.json(messaggi)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { progetto_id, testo, urgente } = await request.json()
  if (!progetto_id || !testo?.trim()) {
    return NextResponse.json({ error: 'progetto_id e testo sono obbligatori' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('chat_messaggi')
    .insert({ progetto_id, autore_id: user.id, testo: testo.trim(), urgente: !!urgente })
    .select('*, autore:profiles(id,nome,avatar_initials)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-mark as read for the sender
  await supabase
    .from('chat_letture')
    .insert({ messaggio_id: data.id, utente_id: user.id })
    .select()

  // If urgente, send immediate email to all formatori/tutors in the project
  if (urgente) {
    // Fire-and-forget — don't block the response
    sendUrgenteEmail(progetto_id, data).catch(err =>
      console.error('[chat/urgente] email error:', err)
    )
  }

  return NextResponse.json({ ...data, letto: true }, { status: 201 })
}

async function sendUrgenteEmail(progetto_id: string, messaggio: { id: string; testo: string; autore?: { nome: string } | null }) {
  const admin = createAdminClient()

  // Get project info
  const { data: progetto } = await admin
    .from('progetti')
    .select('id, school_name')
    .eq('id', progetto_id)
    .single()

  if (!progetto) return

  // Get all formatori/tutors assigned to courses in this project
  const { data: corsi } = await admin
    .from('corsi')
    .select('formatore_id, tutor_id')
    .eq('project_id', progetto_id)

  const memberIds = new Set<string>()
  for (const c of corsi || []) {
    if (c.formatore_id) memberIds.add(c.formatore_id)
    if (c.tutor_id) memberIds.add(c.tutor_id)
  }

  if (memberIds.size === 0) return

  const { data: members } = await admin
    .from('profiles')
    .select('id, nome, email')
    .in('id', [...memberIds])

  const autoreName = (messaggio.autore as { nome: string } | null)?.nome || 'Formascuole'

  for (const member of members || []) {
    const body = `Gentile ${member.nome},

hai ricevuto un messaggio urgente nella chat del progetto "${progetto.school_name}":

${autoreName}: ${messaggio.testo}

Accedi alla piattaforma per rispondere:
${APP_URL}/formatore/progetti/${progetto_id}

Formascuole`

    try {
      await sendEmail({
        to: member.email,
        subject: `🚨 Messaggio urgente — ${progetto.school_name}`,
        body,
      })
    } catch (err) {
      console.error(`[chat/urgente] failed email to ${member.email}:`, err)
    }
  }
}

// Mark messages as read for the current user
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messaggio_ids } = await request.json()
  if (!Array.isArray(messaggio_ids) || messaggio_ids.length === 0) {
    return NextResponse.json({ error: 'messaggio_ids array obbligatorio' }, { status: 400 })
  }

  // Insert read receipts, ignore conflicts (already read)
  const rows = messaggio_ids.map((id: string) => ({ messaggio_id: id, utente_id: user.id }))
  const { error } = await supabase
    .from('chat_letture')
    .upsert(rows, { onConflict: 'messaggio_id,utente_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
