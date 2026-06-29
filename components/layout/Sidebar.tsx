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

interface NavGroup {
  group: string
  icon: React.ReactNode
  items: { href: string; label: string }[]
}
type NavEntry = NavItem | NavGroup

const adminNav: NavEntry[] = [
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
    group: 'Economia',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M16 14a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
        <path d="M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    items: [
      { href: '/economia/estratti-conto', label: 'Estratti conto' },
      { href: '/economia/corsi-completati', label: 'Corsi completati' },
      { href: '/economia/documenti-contabili', label: 'Documenti contabili' },
      { href: '/economia/lettere-incarico', label: 'Lettere d\'incarico' },
      { href: '/partners', label: 'Partner' },
    ],
  } as NavGroup,
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

const tutorStaticNav: NavItem[] = [
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

const formatoreStaticNav: NavItem[] = [
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
    href: '/formatore/valutazioni',
    label: 'Le mie valutazioni',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

const notuleNavItem: NavItem = {
  href: '/formatore/notule',
  label: 'Le mie notule',
  icon: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5"/>
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
}

const creditiNavItem: NavItem = {
  href: '/formatore/crediti',
  label: 'I miei crediti',
  icon: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h1.5m-1.5 0h-1.5m-7.5 0h-1.5m1.5 0H9" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
}

function buildFormatoreNav(regimeFiscale?: string): NavItem[] {
  const docItem = !regimeFiscale || regimeFiscale === 'notula' ? notuleNavItem : creditiNavItem
  // Insert before the last item (account)
  const base = [...formatoreStaticNav]
  base.splice(base.length - 1, 0, docItem)
  return base
}

function buildTutorNav(regimeFiscale?: string): NavItem[] {
  const docItem = !regimeFiscale || regimeFiscale === 'notula' ? notuleNavItem : creditiNavItem
  // Insert between "I miei corsi" and "Il mio account"
  const base = [...tutorStaticNav]
  base.splice(1, 0, docItem)
  return base
}

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
  regimeFiscale?: string
}

export function Sidebar({ role, nome, email, avatarInitials, notificheBadge, isSuperAdmin, isMobileOpen = false, onMobileClose, regimeFiscale }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isSA = isSuperAdmin ?? role === 'super_admin'

  let baseNav: NavEntry[]
  if (role === 'admin' || role === 'super_admin') {
    baseNav = adminNav
  } else if (role === 'tutor') {
    baseNav = buildTutorNav(regimeFiscale)
  } else {
    baseNav = buildFormatoreNav(regimeFiscale)
  }

  const nav: NavEntry[] = isSA ? [...baseNav, finanziamentiNavItem] : baseNav

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
        {nav.map((entry) => {
          if ('group' in entry) {
            const groupActive = entry.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
            return (
              <div key={entry.group} className="mt-1">
                <div className={`flex items-center gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-wider ${groupActive ? 'text-[#d64b55]' : 'text-gray-400'}`}>
                  <span className={groupActive ? 'text-[#d64b55]' : 'text-gray-300'}>{entry.icon}</span>
                  {entry.group}
                </div>
                {entry.items.map(sub => {
                  const isActive = pathname === sub.href || pathname.startsWith(sub.href + '/')
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className={`flex items-center pl-9 pr-3 py-2 rounded-[7px] text-sm font-medium transition-all ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
                      style={isActive ? { backgroundColor: '#d64b55' } : {}}
                    >
                      {sub.label}
                    </Link>
                  )
                })}
              </div>
            )
          }
          // original item rendering (unchanged logic)
          const item = entry  // entry is NavItem here
          const isActive = pathname === item.href || (item.href !== '/formatore' && pathname.startsWith(item.href + '/'))
          const badgeCount = item.href === '/notifiche' ? notificheBadge : undefined
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-[7px] text-sm font-medium transition-all relative ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`} style={isActive ? { backgroundColor: '#d64b55' } : {}}>
              <span className={isActive ? 'text-white' : 'text-gray-400'}>{item.icon}</span>
              {item.label}
              {badgeCount != null && badgeCount > 0 && (
                <span className="ml-auto text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none" style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : '#fbeced', color: isActive ? 'white' : '#d64b55' }}>
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
