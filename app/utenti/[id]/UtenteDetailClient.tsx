'use client'
import Link from 'next/link'
import { Profile, CorsoConOre, UserRole } from '@/lib/types'
import { Avatar } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StatCard } from '@/components/ui/StatCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

type CorsoConProgetto = CorsoConOre & {
  project?: { id: string; school_name: string; anno_scolastico: string } | null
}

interface UtenteDetailClientProps {
  profile: Profile & { roles: UserRole[] }
  corsiFormatore: CorsoConProgetto[]
  corsiTutor: CorsoConProgetto[]
}

function corsoStato(c: CorsoConOre): { label: string; color: string } {
  const pct = Number(c.ore_totali) > 0
    ? Math.round((Number(c.ore_pianificate) / Number(c.ore_totali)) * 100)
    : 0
  if (pct === 0) return { label: 'Da pianificare', color: 'text-gray-400 bg-gray-100' }
  if (pct >= 100) return { label: 'Completato', color: 'text-green-700 bg-green-100' }
  return { label: 'In corso', color: 'text-amber-700 bg-amber-100' }
}

function CorsiTable({ corsi, progettoId }: { corsi: CorsoConProgetto[]; progettoId?: string }) {
  if (corsi.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-gray-400">
        Nessun corso assegnato.
      </div>
    )
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">CORSO</th>
          <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">SCUOLA</th>
          <th className="text-left text-xs font-medium text-gray-400 px-6 py-3 min-w-[160px]">AVANZAMENTO</th>
          <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">STATO</th>
          <th className="px-6 py-3"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {corsi.map(c => {
          const oreTotali = Number(c.ore_totali)
          const orePianificate = Number(c.ore_pianificate)
          const oreResidue = Math.max(oreTotali - orePianificate, 0)
          const pct = oreTotali > 0 ? Math.round((orePianificate / oreTotali) * 100) : 0
          const stato = corsoStato(c)
          const progettoIdCorrente = c.project?.id

          return (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{c.title}</span>
                  <StatusBadge variant={c.tipo} size="sm" />
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-700">{c.project?.school_name || '—'}</div>
                {c.project?.anno_scolastico && (
                  <div className="text-xs text-gray-400">{c.project.anno_scolastico}</div>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="space-y-1">
                  <ProgressBar value={pct} size="sm" showLabel />
                  <div className="text-xs text-gray-400">
                    {orePianificate}h / {oreTotali}h
                    {oreResidue > 0 && <span className="text-gray-300"> · {oreResidue}h residue</span>}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${stato.color}`}>
                  {stato.label}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                {progettoIdCorrente && (
                  <Link
                    href={`/progetti/${progettoIdCorrente}/corsi/${c.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#d64b55] hover:underline"
                  >
                    Vai al corso
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function UtenteDetailClient({ profile, corsiFormatore, corsiTutor }: UtenteDetailClientProps) {
  const isFormatore = profile.roles.includes('formatore')
  const isTutor = profile.roles.includes('tutor')

  // Stats
  const tuttiCorsi = [...corsiFormatore, ...corsiTutor]
  const oreTotali = tuttiCorsi.reduce((s, c) => s + Number(c.ore_totali), 0)
  const orePianificate = tuttiCorsi.reduce((s, c) => s + Number(c.ore_pianificate), 0)
  const pctMedia = oreTotali > 0 ? Math.round((orePianificate / oreTotali) * 100) : 0

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/formatori" className="hover:text-gray-700">Utenti</Link>
        <span>/</span>
        <span className="text-gray-700">{profile.nome}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl p-6 mb-6" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-center gap-5">
          <Avatar nome={profile.nome} id={profile.id} initials={profile.avatar_initials} size="xl" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{profile.nome}</h1>
            <a href={`mailto:${profile.email}`} className="text-sm text-blue-600 hover:underline">
              {profile.email}
            </a>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {profile.roles.filter(r => r !== 'super_admin').map(r => (
                <span key={r} className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${ROLE_COLORS[r]}`}>
                  {ROLE_LABELS[r]}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-gray-400">Account creato il</div>
            <div className="text-sm text-gray-600 font-medium mt-0.5">{formatDate(profile.created_at)}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Corsi come formatore"
          value={corsiFormatore.length}
        />
        <StatCard
          label="Corsi come tutor"
          value={corsiTutor.length}
        />
        <StatCard
          label="Ore totali assegnate"
          value={`${oreTotali}h`}
          subtitle={`${orePianificate}h pianificate`}
        />
        <StatCard
          label="Completamento medio"
          value={`${pctMedia}%`}
          subtitle={tuttiCorsi.length > 0 ? `su ${tuttiCorsi.length} cors${tuttiCorsi.length === 1 ? 'o' : 'i'}` : 'nessun corso'}
        />
      </div>

      {/* Corsi come formatore */}
      {isFormatore && (
        <div className="bg-white rounded-xl mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              Corsi come formatore
              <span className="ml-2 text-sm font-normal text-gray-400">({corsiFormatore.length})</span>
            </h2>
          </div>
          <CorsiTable corsi={corsiFormatore} />
        </div>
      )}

      {/* Corsi come tutor */}
      {isTutor && (
        <div className="bg-white rounded-xl mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              Corsi come tutor
              <span className="ml-2 text-sm font-normal text-gray-400">({corsiTutor.length})</span>
            </h2>
          </div>
          <CorsiTable corsi={corsiTutor} />
        </div>
      )}

      {/* Nessun corso se non è né formatore né tutor */}
      {!isFormatore && !isTutor && (
        <div className="bg-white rounded-xl p-10 text-center" style={{ border: '0.5px solid #e5e5e5' }}>
          <p className="text-sm text-gray-400">Nessun corso assegnato a questo utente.</p>
        </div>
      )}
    </div>
  )
}
