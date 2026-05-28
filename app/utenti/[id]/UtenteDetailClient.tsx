'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Profile, CorsoConOre, UserRole, QuestionarioRisultato } from '@/lib/types'
import { QuestionariBlock, QuestionariMiniCard } from '@/components/ui/QuestionariBlock'
import { Avatar } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StatCard } from '@/components/ui/StatCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

type CorsoConProgetto = CorsoConOre & {
  project?: { id: string; school_name: string; anno_scolastico: string } | null
}

interface UtenteDetailClientProps {
  profile: Profile & { roles: UserRole[] }
  corsiFormatore: CorsoConProgetto[]
  corsiTutor: CorsoConProgetto[]
  isSuperAdmin: boolean
  currentUserId: string
  nRifiutati?: number
  tassoAccettazione?: number | null
  questionari?: QuestionarioRisultato[]
  mediaGlobale?: number | null
  oreErogateFormatore?: number
  oreErogateTutor?: number
}

function corsoStato(c: CorsoConOre): { label: string; color: string } {
  const pct = Number(c.ore_totali) > 0
    ? Math.round((Number(c.ore_pianificate) / Number(c.ore_totali)) * 100)
    : 0
  if (pct === 0) return { label: 'Da pianificare', color: 'text-gray-400 bg-gray-100' }
  if (pct >= 100) return { label: 'Completato', color: 'text-green-700 bg-green-100' }
  return { label: 'In corso', color: 'text-amber-700 bg-amber-100' }
}

function CorsiTable({ corsi }: { corsi: CorsoConProgetto[] }) {
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

export function UtenteDetailClient({ profile, corsiFormatore, corsiTutor, isSuperAdmin, currentUserId, nRifiutati = 0, tassoAccettazione = null, questionari = [], mediaGlobale = null, oreErogateFormatore = 0, oreErogateTutor = 0 }: UtenteDetailClientProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isFormatore = profile.roles.includes('formatore')
  const isTutor = profile.roles.includes('tutor')
  const isSelf = profile.id === currentUserId
  const isTargetSuperAdmin = profile.roles.includes('super_admin')
  const canDelete = isSuperAdmin && !isSelf && !isTargetSuperAdmin

  // Stats
  const oreTotaliFormatore = corsiFormatore.reduce((s, c) => s + Number(c.ore_totali), 0)
  const orePianificateFormatore = corsiFormatore.reduce((s, c) => s + Number(c.ore_pianificate), 0)
  const oreTotaliTutor = corsiTutor.reduce((s, c) => s + Number(c.ore_tutoraggio || 0), 0)
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
          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs text-gray-400">Account creato il</div>
              <div className="text-sm text-gray-600 font-medium mt-0.5">{formatDate(profile.created_at)}</div>
            </div>
            {canDelete && (
              <button
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-[7px] transition-colors"
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Elimina utente
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Corsi come formatore" value={corsiFormatore.length} />
        <StatCard label="Corsi come tutor" value={corsiTutor.length} />
        <StatCard
          label={isFormatore ? 'Ore formazione' : 'Ore totali assegnate'}
          value={`${oreTotaliFormatore}h`}
          subtitle={`${oreErogateFormatore}h erogate`}
        />
        <StatCard
          label="Completamento medio"
          value={`${pctMedia}%`}
          subtitle={tuttiCorsi.length > 0 ? `su ${tuttiCorsi.length} cors${tuttiCorsi.length === 1 ? 'o' : 'i'}` : 'nessun corso'}
        />
      </div>
      {isTutor && oreTotaliTutor > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Ore tutoraggio totali" value={`${oreTotaliTutor}h`} subtitle="budget assegnato" />
          <StatCard label="Ore tutor erogate" value={`${oreErogateTutor}h`} subtitle="proporzionale alle sessioni" />
          <StatCard
            label="% tutoraggio"
            value={oreTotaliTutor > 0 ? `${Math.round((oreErogateTutor / oreTotaliTutor) * 100)}%` : '—'}
            subtitle="completamento tutor"
          />
        </div>
      )}

      {/* Tasso accettazione — solo per formatori */}
      {isFormatore && (corsiFormatore.length > 0 || nRifiutati > 0) && (
        <div className="bg-white rounded-xl p-6 mb-6" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-4">Storico assegnazioni</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-[10px] p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{corsiFormatore.filter(c => c.stato_assegnazione === 'accettato').length}</div>
              <div className="text-xs text-green-600 mt-1">Accettati</div>
            </div>
            <div className="bg-red-50 rounded-[10px] p-4 text-center">
              <div className="text-2xl font-bold text-red-700">{nRifiutati}</div>
              <div className="text-xs text-red-600 mt-1">Rifiutati</div>
            </div>
            <div className="rounded-[10px] p-4 text-center" style={{ backgroundColor: tassoAccettazione !== null ? (tassoAccettazione >= 80 ? '#f0fdf4' : tassoAccettazione >= 50 ? '#fffbeb' : '#fef2f2') : '#f9fafb' }}>
              <div className="text-2xl font-bold" style={{ color: tassoAccettazione !== null ? (tassoAccettazione >= 80 ? '#166534' : tassoAccettazione >= 50 ? '#92400e' : '#991b1b') : '#9ca3af' }}>
                {tassoAccettazione !== null ? `${tassoAccettazione}%` : '—'}
              </div>
              <div className="text-xs mt-1" style={{ color: tassoAccettazione !== null ? '#6b7280' : '#d1d5db' }}>Tasso accettazione</div>
            </div>
          </div>
        </div>
      )}

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

      {!isFormatore && !isTutor && (
        <div className="bg-white rounded-xl p-10 text-center" style={{ border: '0.5px solid #e5e5e5' }}>
          <p className="text-sm text-gray-400">Nessun corso assegnato a questo utente.</p>
        </div>
      )}

      {/* Valutazioni — solo per formatori */}
      {isFormatore && (
        <div className="mt-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Valutazioni questionari</h2>
            <p className="text-sm text-gray-400 mt-0.5">Risultati aggregati dei questionari di valutazione per questo formatore</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <QuestionariMiniCard questionari={questionari} mediaGlobale={mediaGlobale ?? null} />
            </div>
            <div className="lg:col-span-2">
              <QuestionariBlock questionari={questionari} showTexts showStorico />
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Elimina utente — ${profile.nome}`}
        description={`Sei sicuro di voler eliminare ${profile.nome}? Questa azione è irreversibile. I corsi assegnati a questo utente rimarranno ma perderanno il riferimento al formatore/tutor.`}
        confirmName={profile.nome}
        onConfirm={async () => {
          const res = await fetch(`/api/formatori/${profile.id}`, { method: 'DELETE' })
          if (!res.ok) {
            const json = await res.json()
            throw new Error(json.error || 'Errore durante l\'eliminazione')
          }
          router.push('/formatori')
        }}
      />
    </div>
  )
}
