import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { ProgressBar } from '@/components/ui/ProgressBar'

export default async function FormatoriPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/formatore')

  const { data: formatori } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'formatore')
    .order('nome')

  // For each formatore, get corsi stats
  const { data: corsiAll } = await supabase
    .from('corsi_con_ore')
    .select('*')
    .not('formatore_id', 'is', null)

  const { count: notifiche } = await supabase
    .from('solleciti_log')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'sollecito_3')

  const formatoriConStats = (formatori || []).map(f => {
    const corsi = (corsiAll || []).filter(c => c.formatore_id === f.id)
    const oreTotali = corsi.reduce((s: number, c: {ore_totali: number}) => s + Number(c.ore_totali), 0)
    const orePianificate = corsi.reduce((s: number, c: {ore_pianificate: number}) => s + Number(c.ore_pianificate), 0)
    const pct = oreTotali > 0 ? Math.round((orePianificate / oreTotali) * 100) : 0
    return { ...f, n_corsi: corsi.length, oreTotali, orePianificate, pct }
  })

  return (
    <AppLayout role="admin" nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials} notificheBadge={notifiche || 0}>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Formatori</h1>
          <p className="text-sm text-gray-500 mt-1">{formatori?.length || 0} formatori registrati</p>
        </div>

        <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">FORMATORE</th>
                <th className="text-center text-xs font-medium text-gray-400 px-6 py-3">CORSI</th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">ORE TOTALI</th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3 min-w-[200px]">PIANIFICATO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {formatoriConStats.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar nome={f.nome} id={f.id} initials={f.avatar_initials} size="md" />
                      <div>
                        <div className="font-medium text-sm text-gray-900">{f.nome}</div>
                        <div className="text-xs text-gray-400">{f.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-gray-700">{f.n_corsi}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{f.oreTotali}h</td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <ProgressBar value={f.pct} size="sm" showLabel />
                      <div className="text-xs text-gray-400">{f.orePianificate}h / {f.oreTotali}h</div>
                    </div>
                  </td>
                </tr>
              ))}
              {formatoriConStats.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-400">Nessun formatore registrato</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}
