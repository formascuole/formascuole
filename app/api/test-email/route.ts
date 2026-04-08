import { NextResponse } from 'next/server'
import { Resend } from 'resend'

/**
 * GET /api/test-email
 * Sends a test email to admin@formascuole.it using Resend directly.
 * This bypasses generateAssegnazioneEmail (no Claude API call) to isolate
 * whether Resend itself is working.
 */
export async function GET() {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return NextResponse.json({ success: false, error: 'RESEND_API_KEY env var is not set' }, { status: 500 })
  }

  const resend = new Resend(key)
  const timestamp = new Date().toISOString()

  try {
    const result = await resend.emails.send({
      from: 'Formascuole <noreply@formascuole.it>',
      to: 'admin@formascuole.it',
      subject: `[TEST] Email Formascuole — ${timestamp}`,
      text: `Questa è una email di test.\n\nTimestamp: ${timestamp}\nAmbiente: ${process.env.VERCEL_ENV || 'development'}\nRESEND_API_KEY presente: sì`,
      html: `<p>Questa è una <strong>email di test</strong>.</p>
<ul>
  <li>Timestamp: ${timestamp}</li>
  <li>Ambiente: ${process.env.VERCEL_ENV || 'development'}</li>
  <li>RESEND_API_KEY presente: sì</li>
  <li>From: Formascuole &lt;noreply@formascuole.it&gt;</li>
</ul>
<p style="color:#d64b55;font-weight:bold;">Se ricevi questa email, Resend funziona correttamente.</p>`,
    })

    if (result.error) {
      console.error('[test-email] Resend returned error:', result.error)
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    console.log('[test-email] Sent successfully, id:', result.data?.id)
    return NextResponse.json({ success: true, id: result.data?.id, timestamp })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[test-email] Exception:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
