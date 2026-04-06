import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { StatCard } from '@/components/ui/StatCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ProgettoConStats } from '@/lib/types'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/formatore')

  // Stats
  const { data: progetti } = await supabase
    .from('progetti_con_stats')
    .select('*')
    .order('created_at', { ascending: false })

  const progettiList = (progetti || []) as ProgettoConStats[]
  const nProgetti = progettiList.length
  const nCorsi = progettiList.reduce((s, p) => s + Number(p.n_corsi), 0)
  const oreTotali = progettiList.reduce((s, p) => s + Number(p.ore_totali), 0)
  const orePianificate = progettiList.reduce((s, p) => s + Number(p.ore_pianificate), 0)
  const pctGlobale = oreTotali > 0 ? Math.round((orePianificate / oreTotali) * 100) : 0

  // Notifiche non lette (corsi con 3 solleciti inviati)
  const { count: notifiche } = await supabase
    .from('solleciti_log')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'sollecito_3')

  return (
    <AppLayout
      role="admin"
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche || 0}
    >
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Panoramica di tutti i progetti formativi</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Progetti attivi"
            value={nProgetti}
            subtitle={`${progettiList.filter(p => p.status === 'active').length} in corso`}
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            }
          />
          <StatCard
            label="Corsi totali"
            value={nCorsi}
            subtitle="in tutti i progetti"
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3zM3 12l9 4.5 9-4.5M3 17l9 4.5 9-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
          <StatCard
            label="Ore totali"
            value={`${oreTotali}h`}
            subtitle={`${orePianificate}h pianificate`}
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            }
          />
          <StatCard
            label="Completamento globale"
            value={`${pctGlobale}%`}
            subtitle="calendari pianificati"
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
        </div>

        {/* Tabella progetti */}
        <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Tutti i progetti</h2>
            <Link
              href="/progetti"
              className="text-sm font-medium hover:underline"
              style={{ color: '#d64b55' }}
            >
              Vedi tutti →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">SCUOLA</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">ANNO</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-6 py-3">CORSI</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-6 py-3 min-w-[180px]">PROGRESSO</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">STATO</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {progettiList.slice(0, 8).map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-sm text-gray-900">{p.school_name}</div>
                      <div className="text-xs text-gray-400">{p.address}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.anno_scolastico}</td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-gray-700">{p.n_corsi}</td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <ProgressBar value={Number(p.percentuale_completamento)} size="sm" />
                        <div className="text-xs text-gray-400">
                          {p.ore_pianificate}h / {p.ore_totali}h ({p.percentuale_completamento}%)
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge variant={p.status} size="sm" />
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/progetti/${p.id}`}
                        className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        Dettagli →
                      </Link>
                    </td>
                  </tr>
                ))}
                {progettiList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                      Nessun progetto trovato. <Link href="/progetti" className="underline" style={{ color: '#d64b55' }}>Crea il primo progetto</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
