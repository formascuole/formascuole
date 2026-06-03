'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserRole } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
}

const adminNav: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/progetti',
    label: 'Progetti',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/formatori',
    label: 'Utenti',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 20a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M16 11a4 4 0 010 8M19 12a4 4 0 010 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/calendario',
    label: 'Calendario',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/statistiche',
    label: 'Statistiche',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/notifiche',
    label: 'Notifiche',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/catalogo-corsi',
    label: 'Catalogo corsi',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/account',
    label: 'Il mio account',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const tutorNav: NavItem[] = [
  {
    href: '/tutor',
    label: 'I miei corsi',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/account',
    label: 'Il mio account',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const formatoreNav: NavItem[] = [
  {
    href: '/formatore/progetti',
    label: 'Progetti',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/formatore',
    label: 'I miei corsi',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/formatore/calendario',
    label: 'Calendario',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/account',
    label: 'Il mio account',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const finanziamentiNavItem: NavItem = {
  href: '/finanziamenti',
  label: 'Finanziamenti',
  icon: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
      <rect x="2" y="6" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="15" r="1.5" fill="currentColor"/>
    </svg>
  ),
}

interface SidebarProps {
  role: UserRole
  nome: string
  email: string
  avatarInitials: string
  notificheBadge?: number
  isSuperAdmin?: boolean
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ role, nome, email, avatarInitials, notificheBadge, isSuperAdmin, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isSA = isSuperAdmin ?? role === 'super_admin'
  const baseNav = role === 'admin' || role === 'super_admin' ? adminNav : role === 'tutor' ? tutorNav : formatoreNav
  const nav = isSA ? [...baseNav, finanziamentiNavItem] : baseNav

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onMobileClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className={[
        // Mobile: fixed overlay that slides in from the left
        'fixed top-0 bottom-0 left-0 z-50',
        'w-[280px] flex flex-col bg-white',
        'transition-transform duration-200 ease-in-out',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop (md+): back in normal flow, always visible
        'md:static md:translate-x-0 md:w-60 md:shrink-0 md:h-screen',
      ].join(' ')}
      style={{ borderRight: '0.5px solid #e5e5e5' }}
    >
      {/* Logo + mobile close button */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <img
            src="https://www.formascuole.it/wp-content/uploads/2024/01/logo-formascuole-black-red-flag-2048x361.png"
            alt="Formascuole"
            style={{ height: '40px', width: 'auto', maxWidth: '172px', objectFit: 'contain' }}
            onError={(e) => {
              const img = e.currentTarget
              img.style.display = 'none'
              const fallback = img.nextElementSibling as HTMLElement | null
              if (fallback) fallback.style.display = 'block'
            }}
          />
          <span
            className="font-bold text-gray-900 text-base"
            style={{ display: 'none' }}
          >
            Formascuole
          </span>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onMobileClose}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Chiudi menu"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/formatore' && pathname.startsWith(item.href + '/'))
          const badgeCount = item.href === '/notifiche' ? notificheBadge : undefined
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[7px] text-sm font-medium transition-all relative ${
                isActive
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
              style={isActive ? { backgroundColor: '#d64b55' } : {}}
            >
              <span className={isActive ? 'text-white' : 'text-gray-400'}>{item.icon}</span>
              {item.label}
              {badgeCount != null && badgeCount > 0 && (
                <span
                  className="ml-auto text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none"
                  style={{
                    backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : '#fbeced',
                    color: isActive ? 'white' : '#d64b55',
                  }}
                >
                  {badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-[7px] bg-gray-50">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: '#d64b55' }}
          >
            {avatarInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-800 truncate">{nome}</div>
            <div className="text-xs text-gray-400 truncate">{email}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-[7px] text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Esci
        </button>
      </div>
    </aside>
  )
}
