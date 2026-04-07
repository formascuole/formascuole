import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAssegnazioneEmail, sendEmail } from '@/lib/email'

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
    } = body

    if (!corso_id || !formatore_id || !formatore_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const emailBody = await generateAssegnazioneEmail({
      formatore_nome,
      formatore_email,
      corso_title,
      school_name,
      ref_name,
      ref_email,
    })

    await sendEmail({
      to: formatore_email,
      subject: `Formascuole — Assegnazione corso: ${corso_title}`,
      body: emailBody,
    })

    // Log in solleciti_log
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
