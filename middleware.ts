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

  // IMPORTANT: always call getUser() to refresh the session cookie
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // --- Always-public routes (no auth needed) ---
  // API routes handle their own auth — never redirect them
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }
  // Static/public assets already excluded by matcher, but belt+suspenders:
  if (pathname === '/auth/callback') {
    return supabaseResponse
  }

  // --- /login: allow if not logged in; redirect away if logged in ---
  if (pathname === '/login') {
    if (!user) return supabaseResponse

    // User is logged in — send them where they belong.
    // If profile lookup fails for any reason, default to /dashboard
    // (avoids the null-profile redirect loop).
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      const dest = profile?.role === 'formatore' ? '/formatore' : '/dashboard'
      const redirectUrl = new URL(dest, request.url)
      const res = NextResponse.redirect(redirectUrl)
      // Forward session cookies onto the redirect response
      supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
        res.cookies.set(name, value)
      })
      return res
    } catch {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // --- Protected routes: must be authenticated ---
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // --- Role-based access (only when profile is available) ---
  // If the profile lookup fails, let the page itself handle the error
  // rather than creating a redirect loop.
  const adminRoutes = ['/dashboard', '/progetti', '/formatori', '/calendario', '/notifiche']
  const isAdminRoute = adminRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))
  const isFormatoreRoute = pathname === '/formatore' || pathname.startsWith('/formatore/')

  if (isAdminRoute || isFormatoreRoute) {
    let role: string | undefined
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      role = profile?.role
    } catch {
      // DB unavailable — let the page render and show its own error
      return supabaseResponse
    }

    // Only redirect if we have a definitive role; if null, let the page handle it
    if (role) {
      if (isAdminRoute && role !== 'admin') {
        const res = NextResponse.redirect(new URL('/formatore', request.url))
        supabaseResponse.cookies.getAll().forEach(({ name, value }) => res.cookies.set(name, value))
        return res
      }
      if (isFormatoreRoute && role !== 'formatore') {
        const res = NextResponse.redirect(new URL('/dashboard', request.url))
        supabaseResponse.cookies.getAll().forEach(({ name, value }) => res.cookies.set(name, value))
        return res
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public images/assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
}
