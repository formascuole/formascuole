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
}

export function AppLayout({ children, role, nome, email, avatarInitials, notificheBadge, isSuperAdmin }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f7f5]">
      <Sidebar
        role={role}
        nome={nome}
        email={email}
        avatarInitials={avatarInitials}
        notificheBadge={notificheBadge}
        isSuperAdmin={isSuperAdmin}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
