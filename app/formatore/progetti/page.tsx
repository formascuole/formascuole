import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProgressBar } from '@/components/ui/ProgressBar'

const BADGE_PALETTE = [
  { bg: '#dbeafe', text: '#1e40af' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#ede9fe', text: '#5b21b6' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#cffafe', text: '#155e75' },
  { bg: '#ffedd5', text: '#9a3412' },
  { bg: '#f0fdf4', text: '#14532d' },
]
function badgeColor(nome: string) {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) & 0x7fffffff
  return BADGE_PALETTE[h % BADGE_PALETTE.length]
}

export default async function FormatoreProgettiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (profile.role === 'tutor') redirect('/tutor')
  if (!['formatore', 'tutor'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: corsi } = await admin
    .from('corsi_con_ore')
    .select('id, project_id, ore_totali, ore_pianificate, calendario_completo, referente_id, progetti(id,school_name,address,ref_name,ref_email,ref_tel,finanziamento_id)')
    .eq('formatore_id', user.id)

  const { data: finanziamenti } = await supabase.from('finanziamenti').select('id,nome').order('nome')
  const finMap = new Map((finanziamenti || []).map(f => [f.id, f.nome]))

  // Group by project
  type ProgettoInfo = {
    id: string; school_name: string; address?: string
    ref_name: string; ref_email: string; ref_tel?: string
    finanziamento_id?: string | null
  }
  const byProgetto = new Map<string, { progetto: ProgettoInfo; oreT: number; oreP: number; count: number }>()
  for (const c of corsi || []) {
    const p = (Array.isArray(c.progetti) ? c.progetti[0] : c.progetti) as ProgettoInfo | null
    if (!p) continue
    if (!byProgetto.has(c.project_id)) {
      byProgetto.set(c.project_id, { progetto: p, oreT: 0, oreP: 0, count: 0 })
    }
    const entry = byProgetto.get(c.project_id)!
    entry.oreT += Number(c.ore_totali)
    entry.oreP += Number(c.ore_pianificate)
    entry.count++
  }
  const progetti = [...byProgetto.values()]

  return (
    <AppLayout role="formatore" nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials}>
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Progetti</h1>

        {progetti.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center" style={{ border: '0.5px solid #e5e5e5' }}>
            <h3 className="font-semibold text-gray-700 mb-1">Nessun progetto assegnato</h3>
            <p className="text-sm text-gray-400">Contatta l&apos;amministratore per l&apos;assegnazione</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {progetti.map(({ progetto, oreT, oreP, count }) => {
              const pct = oreT > 0 ? Math.min(Math.round((oreP / oreT) * 100), 100) : 0
              const finNome = progetto.finanziamento_id ? finMap.get(progetto.finanziamento_id) : null
              const color = finNome ? badgeColor(finNome) : null

              return (
                <Link
                  key={progetto.id}
                  href={`/formatore/progetti/${progetto.id}`}
                  className="block bg-white rounded-xl px-5 py-4 hover:shadow-sm transition-shadow"
                  style={{ border: '0.5px solid #e5e5e5' }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h2 className="font-semibold text-gray-900">{progetto.school_name}</h2>
                        {finNome && color && (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-md shrink-0"
                            style={{ backgroundColor: color.bg, color: color.text }}
                          >
                            {finNome}
                          </span>
                        )}
                      </div>
                      {progetto.address && (
                        <p className="text-xs text-gray-400">{progetto.address}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-gray-900">{pct}%</div>
                      <div className="text-xs text-gray-400">{count} cors{count === 1 ? 'o' : 'i'}</div>
                    </div>
                  </div>

                  {/* Referente */}
                  <div className="flex items-start gap-2 text-xs bg-gray-50 rounded-[7px] px-3 py-2 mb-3">
                    <svg className="text-gray-400 mt-0.5 shrink-0" width="13" height="13" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <div>
                      <span className="font-medium text-gray-700">{progetto.ref_name}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span className="text-blue-600">{progetto.ref_email}</span>
                      {progetto.ref_tel && (
                        <><span className="text-gray-400 mx-1">·</span><span className="text-gray-500">{progetto.ref_tel}</span></>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{oreP}h pianificate su {oreT}h totali</span>
                    </div>
                    <ProgressBar value={pct} size="sm" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
