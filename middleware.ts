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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes
  if (pathname === '/login' || pathname.startsWith('/api/cron')) {
    if (user && pathname === '/login') {
      // Redirect logged-in users away from login
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      const dest = profile?.role === 'admin' ? '/dashboard' : '/formatore'
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return supabaseResponse
  }

  // Protected routes — require authentication
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based access
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // Admin-only routes
  const adminRoutes = ['/dashboard', '/progetti', '/formatori', '/calendario', '/notifiche']
  const isAdminRoute = adminRoutes.some((r) => pathname.startsWith(r))

  // Formatore-only routes
  const formatoreRoutes = ['/formatore']
  const isFormatoreRoute = formatoreRoutes.some((r) => pathname.startsWith(r))

  if (isAdminRoute && role !== 'admin') {
    return NextResponse.redirect(new URL('/formatore', request.url))
  }

  if (isFormatoreRoute && role !== 'formatore') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
