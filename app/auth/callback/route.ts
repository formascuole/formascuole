import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// This route handles the Supabase Auth callback (PKCE flow, email confirmation, OAuth).
// For email+password login it is not strictly needed, but Supabase may redirect here
// when confirming email addresses or handling magic links.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const error = searchParams.get('error')

  if (error) {
    // Auth error (e.g. expired link) — send back to login with message
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) {
      // Code exchanged successfully — determine destination by role
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        const dest = profile?.role === 'formatore' ? '/formatore' : '/dashboard'
        return NextResponse.redirect(`${origin}${dest}`)
      }
    }
  }

  // Fallback — redirect to the requested next path or login
  const safeNext = next.startsWith('/') ? next : '/'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
