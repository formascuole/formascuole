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
    pathname.startsWith('/auth/')
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

  // Authenticated — let the server component decide role-based access.
  // NO DB queries here. Role checks in the middleware caused the loop
  // when profiles were null (dashboard→formatore→dashboard→...).
  return supabaseResponse
}

export const config = {
  matcher: [
    // Match everything except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
}
