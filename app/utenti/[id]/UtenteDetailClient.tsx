'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Profile, CorsoConOre, UserRole, QuestionarioRisultato } from '@/lib/types'
import { QuestionariBlock, QuestionariMiniCard } from '@/components/ui/QuestionariBlock'
import { Avatar } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StatCard } from '@/components/ui/StatCard'
import { DualProgressBar } from '@/components/ui/DualProgressBar'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
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
  oreErogatePerCorsoFormatore?: Record<string, number>
  oreErogatePerCorsoTutor?: Record<string, number>
  isAdmin: boolean
}

function corsoStato(c: CorsoConOre, oreErogate: number): { label: string; color: string } {
  const oreTotali = Number(c.ore_totali)
  const orePianificate = Number(c.ore_pianificate)
  if (orePianificate === 0) return { label: 'Da pianificare', color: 'text-gray-400 bg-gray-100' }
  if (oreTotali > 0 && oreErogate >= oreTotali) return { label: 'Completato', color: 'text-green-700 bg-green-100' }
  return { label: 'In corso', color: 'text-amber-700 bg-amber-100' }
}

function CorsiTable({ corsi, oreErogateMap = {} }: { corsi: CorsoConProgetto[]; oreErogateMap?: Record<string, number> }) {
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
          const oreEro = oreErogateMap[c.id] ?? 0
          const stato = corsoStato(c, oreEro)
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
              <td className="px-6 py-4 min-w-[200px]">
                <DualProgressBar oreTotali={oreTotali} orePianificate={orePianificate} oreErogate={oreEro} />
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

export function UtenteDetailClient({ profile, corsiFormatore, corsiTutor, isSuperAdmin, currentUserId, nRifiutati = 0, tassoAccettazione = null, questionari = [], mediaGlobale = null, oreErogateFormatore = 0, oreErogateTutor = 0, oreErogatePerCorsoFormatore = {}, oreErogatePerCorsoTutor = {}, isAdmin }: UtenteDetailClientProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)

  type RegimeFiscale = 'forfettario' | 'ordinario' | 'notula'
  const REGIME_LABELS: Record<RegimeFiscale, string> = {
    forfettario: 'Regime forfettario',
    ordinario:   'Regime ordinario',
    notula:      'Prestazione occasionale',
  }
  const REGIME_BADGE_CLS: Record<RegimeFiscale, string> = {
    forfettario: 'bg-green-100 text-green-700',
    ordinario:   'bg-blue-100 text-blue-700',
    notula:      'bg-orange-100 text-orange-700',
  }

  const [tariffaForm, setTariffaForm] = useState({
    tariffa_oraria_formatore: profile.tariffa_oraria_formatore != null ? String(profile.tariffa_oraria_formatore) : '',
    tariffa_oraria_tutor: profile.tariffa_oraria_tutor != null ? String(profile.tariffa_oraria_tutor) : '',
    ha_partita_iva: profile.ha_partita_iva ?? false,
    regime_fiscale: (profile.regime_fiscale ?? 'notula') as RegimeFiscale,
    rivalsa_iva: profile.rivalsa_iva ?? false,
    partita_iva: profile.partita_iva ?? '',
  })
  const [tariffaSaving, setTariffaSaving] = useState(false)
  const [tariffaModalOpen, setTariffaModalOpen] = useState(false)
  const [savedTariffe, setSavedTariffe] = useState({
    tariffa_oraria_formatore: profile.tariffa_oraria_formatore ?? null,
    tariffa_oraria_tutor: profile.tariffa_oraria_tutor ?? null,
    ha_partita_iva: profile.ha_partita_iva ?? false,
    regime_fiscale: (profile.regime_fiscale ?? 'notula') as RegimeFiscale,
    rivalsa_iva: profile.rivalsa_iva ?? false,
    partita_iva: profile.partita_iva ?? null,
  })

  const isFormatore = profile.roles.includes('formatore')
  const isTutor = profile.roles.includes('tutor')
  const isSelf = profile.id === currentUserId
  const isTargetSuperAdmin = profile.roles.includes('super_admin')
  const canDelete = isSuperAdmin && !isSelf && !isTargetSuperAdmin

  const handleSaveTariffe = async () => {
    setTariffaSaving(true)
    try {
      const body: Record<string, unknown> = {
        ha_partita_iva: tariffaForm.ha_partita_iva,
        regime_fiscale: tariffaForm.ha_partita_iva ? tariffaForm.regime_fiscale : 'notula',
        rivalsa_iva: tariffaForm.ha_partita_iva && tariffaForm.regime_fiscale === 'ordinario' ? tariffaForm.rivalsa_iva : false,
        partita_iva: tariffaForm.ha_partita_iva ? (tariffaForm.partita_iva.trim() || null) : null,
      }
      if (isFormatore) body.tariffa_oraria_formatore = tariffaForm.tariffa_oraria_formatore.trim() ? Number(tariffaForm.tariffa_oraria_formatore) : null
      if (isTutor) body.tariffa_oraria_tutor = tariffaForm.tariffa_oraria_tutor.trim() ? Number(tariffaForm.tariffa_oraria_tutor) : null
      const res = await fetch(`/api/utenti/${profile.id}/tariffa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedTariffe({
          tariffa_oraria_formatore: data.tariffa_oraria_formatore ?? null,
          tariffa_oraria_tutor: data.tariffa_oraria_tutor ?? null,
          ha_partita_iva: data.ha_partita_iva ?? false,
          regime_fiscale: (data.regime_fiscale ?? 'notula') as RegimeFiscale,
          rivalsa_iva: data.rivalsa_iva ?? false,
          partita_iva: data.partita_iva ?? null,
        })
        setTariffaModalOpen(false)
      }
    } finally {
      setTariffaSaving(false)
    }
  }

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
              {(profile.roles.includes('formatore') || profile.roles.includes('tutor')) && (
                profile.profilo_completo
                  ? <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-green-100 text-green-700">Profilo completo</span>
                  : <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-red-100 text-red-700">Profilo incompleto</span>
              )}
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
          <CorsiTable corsi={corsiFormatore} oreErogateMap={oreErogatePerCorsoFormatore} />
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
          <CorsiTable corsi={corsiTutor} oreErogateMap={oreErogatePerCorsoTutor} />
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

      {/* Tariffe orarie — visibile solo ad admin */}
      {isAdmin && (profile.roles.includes('formatore') || profile.roles.includes('tutor')) && (
        <div className="bg-white rounded-xl p-6 mt-6" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Tariffe orarie</h2>
            <Button variant="secondary" size="sm" onClick={() => {
              setTariffaForm({
                tariffa_oraria_formatore: savedTariffe.tariffa_oraria_formatore != null ? String(savedTariffe.tariffa_oraria_formatore) : '',
                tariffa_oraria_tutor: savedTariffe.tariffa_oraria_tutor != null ? String(savedTariffe.tariffa_oraria_tutor) : '',
                ha_partita_iva: savedTariffe.ha_partita_iva,
                regime_fiscale: savedTariffe.regime_fiscale,
                rivalsa_iva: savedTariffe.rivalsa_iva,
                partita_iva: savedTariffe.partita_iva ?? '',
              })
              setTariffaModalOpen(true)
            }}>
              Modifica
            </Button>
          </div>
          <div className="space-y-3">
            {isFormatore && (
              <TariffaAdminRow
                label={isTutor ? 'Tariffa come formatore' : 'Tariffa oraria'}
                value={savedTariffe.tariffa_oraria_formatore}
              />
            )}
            {isTutor && (
              <TariffaAdminRow
                label={isFormatore ? 'Tariffa come tutor' : 'Tariffa oraria tutor'}
                value={savedTariffe.tariffa_oraria_tutor}
              />
            )}
            {isFormatore && (
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Regime fiscale</span>
                <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${REGIME_BADGE_CLS[savedTariffe.regime_fiscale] ?? REGIME_BADGE_CLS.notula}`}>
                  {REGIME_LABELS[savedTariffe.regime_fiscale] ?? REGIME_LABELS.notula}
                  {savedTariffe.regime_fiscale === 'ordinario' && savedTariffe.rivalsa_iva && ' + IVA 22%'}
                </span>
              </div>
            )}
            {isFormatore && savedTariffe.ha_partita_iva && savedTariffe.partita_iva && (
              <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">Partita IVA</span>
                <span className="text-sm font-mono font-medium text-gray-700">{savedTariffe.partita_iva}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dati fiscali e bancari — visibile solo ad admin */}
      {isAdmin && (profile.roles.includes('formatore') || profile.roles.includes('tutor')) && (
        <div className="bg-white rounded-xl p-6 mt-6" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-4">Dati fiscali e bancari</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            <FiscalAdminRow label="Luogo di nascita" value={profile.luogo_nascita} />
            <FiscalAdminRow label="Data di nascita" value={profile.data_nascita
              ? new Date(profile.data_nascita).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
              : null
            } />
            <FiscalAdminRow label="Codice fiscale" value={profile.codice_fiscale} mono />
            <FiscalAdminRow label="Indirizzo" value={[profile.indirizzo_via, profile.indirizzo_cap, profile.indirizzo_citta, profile.indirizzo_provincia].filter(Boolean).join(', ') || null} />
            <FiscalAdminRow label="IBAN" value={profile.iban} mono />
            <FiscalAdminRow label="Banca" value={profile.banca} />
            <FiscalAdminRow label="Intestatario conto" value={profile.intestatario_conto} />
          </div>
        </div>
      )}

      {/* Modal modifica tariffe */}
      <Modal
        open={tariffaModalOpen}
        onClose={() => setTariffaModalOpen(false)}
        title="Modifica tariffe orarie"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTariffaModalOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveTariffe} loading={tariffaSaving}>Salva</Button>
          </>
        }
      >
        <div className="space-y-4">
          {isFormatore && (
            <Input
              label={isTutor ? 'Tariffa come formatore (€/h)' : 'Tariffa oraria (€/h)'}
              type="number"
              min={0}
              step={0.01}
              value={tariffaForm.tariffa_oraria_formatore}
              onChange={e => setTariffaForm(f => ({ ...f, tariffa_oraria_formatore: e.target.value }))}
              placeholder="Es. 45.00"
              hint="Lascia vuoto per rimuovere"
            />
          )}
          {isTutor && (
            <Input
              label={isFormatore ? 'Tariffa come tutor (€/h)' : 'Tariffa oraria tutor (€/h)'}
              type="number"
              min={0}
              step={0.01}
              value={tariffaForm.tariffa_oraria_tutor}
              onChange={e => setTariffaForm(f => ({ ...f, tariffa_oraria_tutor: e.target.value }))}
              placeholder="Es. 25.00"
              hint="Lascia vuoto per rimuovere"
            />
          )}
          {isFormatore && (
            <>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Regime fiscale</p>
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">Ha Partita IVA?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTariffaForm(f => ({
                        ...f,
                        ha_partita_iva: true,
                        regime_fiscale: f.regime_fiscale === 'notula' ? 'forfettario' : f.regime_fiscale,
                      }))}
                      className={`flex-1 py-1.5 rounded-[7px] text-sm font-medium border transition-colors ${tariffaForm.ha_partita_iva ? 'bg-[#d64b55] text-white border-[#d64b55]' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                    >
                      Sì
                    </button>
                    <button
                      type="button"
                      onClick={() => setTariffaForm(f => ({ ...f, ha_partita_iva: false, regime_fiscale: 'notula', rivalsa_iva: false }))}
                      className={`flex-1 py-1.5 rounded-[7px] text-sm font-medium border transition-colors ${!tariffaForm.ha_partita_iva ? 'bg-[#d64b55] text-white border-[#d64b55]' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
              {tariffaForm.ha_partita_iva && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">Numero Partita IVA</p>
                  <input
                    type="text"
                    value={tariffaForm.partita_iva}
                    onChange={e => setTariffaForm(f => ({ ...f, partita_iva: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                    placeholder="12345678901"
                    maxLength={11}
                    className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors font-mono mb-3"
                  />
                </div>
              )}
              {tariffaForm.ha_partita_iva && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1.5">Regime</p>
                  <select
                    value={tariffaForm.regime_fiscale === 'notula' ? 'forfettario' : tariffaForm.regime_fiscale}
                    onChange={e => setTariffaForm(f => ({
                      ...f,
                      regime_fiscale: e.target.value as RegimeFiscale,
                      rivalsa_iva: e.target.value !== 'ordinario' ? false : f.rivalsa_iva,
                    }))}
                    className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors bg-white"
                  >
                    <option value="forfettario">Regime forfettario</option>
                    <option value="ordinario">Regime ordinario</option>
                  </select>
                </div>
              )}
              {tariffaForm.ha_partita_iva && tariffaForm.regime_fiscale === 'ordinario' && (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tariffaForm.rivalsa_iva}
                    onChange={e => setTariffaForm(f => ({ ...f, rivalsa_iva: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 accent-[#d64b55]"
                  />
                  <span className="text-sm text-gray-700">Applica rivalsa IVA 22%</span>
                </label>
              )}
            </>
          )}
        </div>
      </Modal>

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

function FiscalAdminRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>
        {value || <span className="text-gray-300">—</span>}
      </span>
    </div>
  )
}

function TariffaAdminRow({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium font-mono text-gray-900">
        {value != null ? `€ ${Number(value).toFixed(2)}/h` : <span className="text-gray-300 font-sans">Non definita</span>}
      </span>
    </div>
  )
}
