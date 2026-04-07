import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

// Sends a daily digest of unread chat messages to each user who has unread messages.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  try {
    // Find all messages not yet read by their intended recipients.
    // "Unread" = message exists in chat_messaggi but NOT in chat_letture for a given user.
    // We focus on users who have courses in the project and are not the author.
    const { data: projects } = await supabase
      .from('progetti')
      .select('id, school_name')

    if (!projects?.length) {
      return NextResponse.json({ message: 'No projects', processed: 0 })
    }

    const results: { progetto_id: string; emails_sent: number }[] = []

    for (const project of projects) {
      // Get all messages in the last 24h that haven't been read
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data: messages } = await supabase
        .from('chat_messaggi')
        .select('id, autore_id, testo, created_at, autore:profiles(nome)')
        .eq('progetto_id', project.id)
        .gte('created_at', since)
        .order('created_at', { ascending: true })

      if (!messages?.length) continue

      // Find members of this project (formatori and tutors assigned to courses)
      const { data: corsi } = await supabase
        .from('corsi')
        .select('formatore_id, tutor_id')
        .eq('project_id', project.id)

      const memberIds = new Set<string>()
      for (const c of corsi || []) {
        if (c.formatore_id) memberIds.add(c.formatore_id)
        if (c.tutor_id) memberIds.add(c.tutor_id)
      }

      if (memberIds.size === 0) continue

      // Get member profiles
      const { data: members } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .in('id', [...memberIds])

      let emailsSent = 0
      for (const member of members || []) {
        // Which of these messages has this member NOT read?
        const msgIds = messages.map(m => m.id)
        const { data: readReceipts } = await supabase
          .from('chat_letture')
          .select('messaggio_id')
          .eq('utente_id', member.id)
          .in('messaggio_id', msgIds)

        const readIds = new Set((readReceipts || []).map(r => r.messaggio_id))
        const unread = messages.filter(m => !readIds.has(m.id) && m.autore_id !== member.id)

        if (unread.length === 0) continue

        // Build digest email body
        const msgLines = unread.map(m => {
          const autoreNome = (m.autore as unknown as { nome: string } | null)?.nome || 'Utente'
          const date = new Date(m.created_at).toLocaleString('it-IT', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
          })
          return `[${date}] ${autoreNome}: ${m.testo}`
        }).join('\n')

        const body = `Gentile ${member.nome},

hai ${unread.length} mess${unread.length === 1 ? 'aggio' : 'aggi'} non letti nella chat del progetto "${project.school_name}":

${msgLines}

Accedi alla piattaforma per rispondere:
${APP_URL}/progetti/${project.id}

Formascuole`

        try {
          await sendEmail({
            to: member.email,
            subject: `Formascuole — ${unread.length} mess${unread.length === 1 ? 'aggio' : 'aggi'} non lett${unread.length === 1 ? 'o' : 'i'} in "${project.school_name}"`,
            body,
          })
          emailsSent++
        } catch (err) {
          console.error(`Failed digest email to ${member.email}:`, err)
        }
      }

      results.push({ progetto_id: project.id, emails_sent: emailsSent })
    }

    const totalEmails = results.reduce((s, r) => s + r.emails_sent, 0)
    return NextResponse.json({
      success: true,
      projects_checked: projects.length,
      emails_sent: totalEmails,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Chat digest cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
