import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAssegnazioneEmail, sendEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      corso_id,
      formatore_id,
      formatore_nome,
      formatore_email,
      corso_title,
      school_name,
      ref_name,
      ref_email,
      ore_totali,
      tipo,
    } = body

    if (!corso_id || !formatore_id || !formatore_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const accetta_url = `${APP_URL}/formatore/corsi/${corso_id}/accetta`
    const rifiuta_url = `${APP_URL}/formatore/corsi/${corso_id}/rifiuta`

    const emailBody = await generateAssegnazioneEmail({
      formatore_nome,
      formatore_email,
      corso_title,
      school_name,
      ref_name,
      ref_email,
      ore_totali,
      tipo,
      accetta_url,
      rifiuta_url,
    })

    await sendEmail({
      to: formatore_email,
      subject: `Formascuole — Nuovo corso assegnato: ${corso_title} — ${school_name}`,
      body: emailBody,
      actions: [
        { label: '✓ Accetta incarico', url: accetta_url, primary: true },
        { label: '✗ Rifiuta incarico', url: rifiuta_url },
      ],
    })

    const adminClient = createAdminClient()
    await adminClient.from('solleciti_log').insert({
      corso_id,
      formatore_id,
      tipo: 'assegnazione',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email assegnazione error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
