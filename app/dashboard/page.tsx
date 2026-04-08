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
  if (!profile || !['admin','super_admin'].includes(profile.role)) redirect('/formatore')

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
  const oreTutoraggioTotali = progettiList.reduce((s, p) => s + Number(p.ore_tutoraggio_totali || 0), 0)
  const oreTutor_aggioPianificate = progettiList.reduce((s, p) => s + Number(p.ore_tutoraggio_pianificate || 0), 0)

  const { count: notifiche } = await supabase
    .from('solleciti_log')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'sollecito_3')

  // Accettazione stats
  const { count: corsiInAttesa } = await supabase
    .from('corsi')
    .select('*', { count: 'exact', head: true })
    .eq('stato_assegnazione', 'in_attesa')

  const thisMonthStart = new Date()
  thisMonthStart.setDate(1)
  thisMonthStart.setHours(0, 0, 0, 0)

  const { count: corsiRifiutatiMese } = await supabase
    .from('corsi')
    .select('*', { count: 'exact', head: true })
    .eq('stato_assegnazione', 'rifiutato')
    .gte('accettazione_risposta_at', thisMonthStart.toISOString())

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche || 0}
    >
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Panoramica di tutti i progetti formativi</p>
        </div>

        {/* Stat cards — riga 1 */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <StatCard
            label="Progetti attivi"
            value={nProgetti}
            subtitle={`${progettiList.filter(p => p.status === 'active').length} in corso`}
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5"/></svg>}
          />
          <StatCard
            label="Corsi totali"
            value={nCorsi}
            subtitle="in tutti i progetti"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 3l9 4.5-9 4.5-9-4.5L12 3zM3 12l9 4.5 9-4.5M3 17l9 4.5 9-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />
          <StatCard
            label="Ore formazione totali"
            value={`${oreTotali}h`}
            subtitle={`${orePianificate}h pianificate`}
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          />
          <StatCard
            label="Completamento globale"
            value={`${pctGlobale}%`}
            subtitle="calendari pianificati"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />
        </div>

        {/* Stat cards — riga 2: tutoraggio */}
        {oreTutoraggioTotali > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Ore tutoraggio totali"
              value={`${oreTutoraggioTotali}h`}
              subtitle="corsi PF con tutor previsto"
              icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M3 20a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M19 13v6M16 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            />
            <StatCard
              label="Ore tutoraggio pianificate"
              value={`${oreTutor_aggioPianificate}h`}
              subtitle="stima proporzionale al completamento"
              icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            />
          </div>
        )}
        {oreTutoraggioTotali === 0 && <div className="mb-4" />}

        {/* Stat cards — accettazione */}
        {((corsiInAttesa ?? 0) > 0 || (corsiRifiutatiMese ?? 0) > 0) && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            {(corsiInAttesa ?? 0) > 0 && (
              <Link href="/progetti?in_attesa=1" className="block hover:opacity-90 transition-opacity">
                <StatCard
                  label="In attesa di accettazione"
                  value={corsiInAttesa ?? 0}
                  subtitle="clicca per vedere i progetti →"
                  icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/></svg>}
                />
              </Link>
            )}
            {(corsiRifiutatiMese ?? 0) > 0 && (
              <StatCard
                label="Rifiutati questo mese"
                value={corsiRifiutatiMese ?? 0}
                subtitle="da riassegnare"
                icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
              />
            )}
          </div>
        )}
        {(corsiInAttesa ?? 0) === 0 && (corsiRifiutatiMese ?? 0) === 0 && <div className="mb-4" />}

        {/* Tabella progetti */}
        <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Tutti i progetti</h2>
            <Link href="/progetti" className="text-sm font-medium hover:underline" style={{ color: '#d64b55' }}>
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
                  <th className="text-left text-xs font-medium text-gray-400 px-6 py-3 min-w-[180px]">PIANIFICAZIONE</th>
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
                      <Link href={`/progetti/${p.id}`} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                        Dettagli →
                      </Link>
                    </td>
                  </tr>
                ))}
                {progettiList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                      Nessun progetto trovato.{' '}
                      <Link href="/progetti" className="underline" style={{ color: '#d64b55' }}>
                        Crea il primo progetto
                      </Link>
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
