'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Panoramica', href: '/statistiche', exact: true },
  { label: 'Corsi', href: '/statistiche/corsi', exact: false },
  { label: 'Valutazioni', href: '/statistiche/questionari', exact: false },
]

export function StatisticheNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b border-gray-100 mb-6 -mt-2">
      {TABS.map(tab => {
        const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              isActive
                ? 'border-[#d64b55] text-[#d64b55]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
