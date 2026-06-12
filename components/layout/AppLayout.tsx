'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { UserRole } from '@/lib/types'

interface AppLayoutProps {
  children: React.ReactNode
  role: UserRole
  nome: string
  email: string
  avatarInitials: string
  notificheBadge?: number
  isSuperAdmin?: boolean
  regimeFiscale?: string
}

export function AppLayout({ children, role, nome, email, avatarInitials, notificheBadge, isSuperAdmin, regimeFiscale }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f7f5]">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        role={role}
        nome={nome}
        email={email}
        avatarInitials={avatarInitials}
        notificheBadge={notificheBadge}
        isSuperAdmin={isSuperAdmin}
        regimeFiscale={regimeFiscale}
        isMobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* Right column: mobile header + page content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile-only header */}
        <header className="flex md:hidden items-center h-14 px-3 bg-white border-b border-gray-100 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
            aria-label="Apri menu"
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          <span className="flex-1 text-center text-base font-bold text-gray-900">Formascuole</span>

          {/* Spacer to keep title visually centred */}
          <div className="w-11" aria-hidden="true" />
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
