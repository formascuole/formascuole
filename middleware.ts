import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() must be called to keep the session cookie fresh.
  // Do NOT add business logic between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Always-public: pass through without any redirect ──────────────────
  if (
    pathname.startsWith('/api/') ||        // API routes handle their own auth
    pathname === '/auth/callback' ||        // Supabase PKCE / email confirmation
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/assegnazioni/') ||       // token-based public acceptance page
    pathname.startsWith('/pre-assegnazioni/') ||   // token-based public pre-assignment page
    pathname === '/reset-password'                  // password reset (session set by auth callback)
  ) {
    return supabaseResponse
  }

  // ── /login ─────────────────────────────────────────────────────────────
  if (pathname === '/login') {
    if (!user) {
      // Not logged in → show login page
      return supabaseResponse
    }
    // Already logged in → send to dashboard as safe default.
    // Role-based routing (admin vs formatore) is done by the server components;
    // we purposely avoid a DB query here to keep the middleware simple and
    // to prevent the loop caused by null-profile ↔ DB-error scenarios.
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(({ name, value }) =>
      res.cookies.set(name, value)
    )
    return res
  }

  // ── All other routes: must be authenticated ────────────────────────────
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Preserve the original destination so we can redirect after login if needed
    url.searchParams.set('next', pathname)
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(({ name, value }) =>
      res.cookies.set(name, value)
    )
    return res
  }

  // ── Onboarding redirect for formatori/tutori ───────────────────────────
  // /onboarding (all sub-paths) is exempt to avoid an infinite redirect loop.
  // We query only 4 columns by PK — the smallest possible footprint.
  // On DB error we silently let through; the page itself handles auth.
  if (!pathname.startsWith('/onboarding')) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, privacy_accettata, password_cambiata, profilo_completo')
        .eq('id', user.id)
        .single()

      if (profile && (profile.role === 'formatore' || profile.role === 'tutor')) {
        const url = request.nextUrl.clone()
        url.search = ''
        // Step 0: privacy must be accepted first
        if (!profile.privacy_accettata) {
          url.pathname = '/onboarding/privacy'
          const res = NextResponse.redirect(url)
          supabaseResponse.cookies.getAll().forEach(({ name, value }) =>
            res.cookies.set(name, value)
          )
          return res
        }
        // Steps 1-2: password + profilo
        if (!profile.password_cambiata || !profile.profilo_completo) {
          url.pathname = '/onboarding'
          const res = NextResponse.redirect(url)
          supabaseResponse.cookies.getAll().forEach(({ name, value }) =>
            res.cookies.set(name, value)
          )
          return res
        }
      }
    } catch {
      // DB unavailable → let through, pages handle their own auth
    }
  }

  // Authenticated — let the server component decide role-based access.
  return supabaseResponse
}

export const config = {
  matcher: [
    // Match everything except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
}
