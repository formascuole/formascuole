'use client'
import { useState, useMemo } from 'react'
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
  sessionDatesByCorso?: Record<string, { prima: string; ultima: string }>
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

export function UtenteDetailClient({ profile, corsiFormatore, corsiTutor, isSuperAdmin, currentUserId, nRifiutati = 0, tassoAccettazione = null, questionari = [], mediaGlobale = null, oreErogateFormatore = 0, oreErogateTutor = 0, oreErogatePerCorsoFormatore = {}, oreErogatePerCorsoTutor = {}, isAdmin, sessionDatesByCorso = {} }: UtenteDetailClientProps) {
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

      {/* Estratto conto — visibile solo ad admin per formatori */}
      {isFormatore && isAdmin && (
        <EstrattoContoSection
          corsiFormatore={corsiFormatore}
          sessionDatesByCorso={sessionDatesByCorso}
          savedTariffe={savedTariffe}
          nomeFormatore={profile.nome}
        />
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
            {profile.telefono && (
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Telefono</span>
                <a href={`tel:${profile.telefono}`} className="text-sm font-medium text-blue-600 hover:underline">
                  {profile.telefono}
                </a>
              </div>
            )}
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

// ── Estratto Conto ────────────────────────────────────────────────────────────

type RegimeFiscaleEC = 'forfettario' | 'ordinario' | 'notula'

interface CorsoEC {
  corso_id: string
  title: string
  school_name: string
  ore_erogate: number
  tariffa: number | null
  prima_sessione: string | null
  ultima_sessione: string | null
  anno: number | null
  imponibile: number
  ritenuteIva: number
  netto: number
  regimeFiscale: RegimeFiscaleEC
  rivalsaIva: boolean
}

function calcEC(ore: number, tariffa: number, regime: RegimeFiscaleEC, rivalsa: boolean): { imponibile: number; ritenuteIva: number; netto: number } {
  const imponibile = ore * tariffa
  if (regime === 'notula') {
    const ritenuta = imponibile * 0.2
    return { imponibile, ritenuteIva: -ritenuta, netto: imponibile - ritenuta }
  }
  if (regime === 'ordinario' && rivalsa) {
    const iva = imponibile * 0.22
    return { imponibile, ritenuteIva: iva, netto: imponibile + iva }
  }
  return { imponibile, ritenuteIva: 0, netto: imponibile }
}

function fmtDateShortEC(d: string | null): string | null {
  if (!d) return null
  const [y, m, day] = d.substring(0, 10).split('-')
  return `${day}/${m}/${y.slice(2)}`
}

function fmtCurrency(n: number) {
  return `€ ${n.toFixed(2)}`
}

async function exportEstrattoContoExcel(rows: CorsoEC[], nomeFormatore: string, annoFilter: string) {
  const XLSX = await import('xlsx')
  const fmt = (d: string | null) => {
    if (!d) return ''
    const [y, m, day] = d.substring(0, 10).split('-')
    return `${day}/${m}/${y.slice(2)}`
  }
  const headers = ['Corso', 'Scuola', 'Periodo', 'Ore', 'Tariffa (€/h)', 'Imponibile (€)', 'Ritenuta/IVA (€)', 'Netto (€)']
  const data: (string | number)[][] = rows.map(r => [
    r.title,
    r.school_name,
    [r.prima_sessione ? fmt(r.prima_sessione) : null, r.ultima_sessione ? fmt(r.ultima_sessione) : null].filter(Boolean).join(' – ') || '—',
    r.ore_erogate,
    r.tariffa ?? '',
    r.tariffa ? r.imponibile : '',
    r.tariffa ? r.ritenuteIva : '',
    r.tariffa ? r.netto : '',
  ])
  const totOre = rows.reduce((s, r) => s + r.ore_erogate, 0)
  const totImponibile = rows.filter(r => r.tariffa).reduce((s, r) => s + r.imponibile, 0)
  const totRit = rows.filter(r => r.tariffa).reduce((s, r) => s + r.ritenuteIva, 0)
  const totNetto = rows.filter(r => r.tariffa).reduce((s, r) => s + r.netto, 0)
  data.push(['TOTALE', '', '', totOre, '', totImponibile, totRit, totNetto])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(Math.max(h.length, ...data.map(r => String(r[i] ?? '').length)) + 2, 40),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Estratto conto')
  XLSX.writeFile(wb, `Estratto_${nomeFormatore.replace(/\s+/g, '_')}_${annoFilter}.xlsx`)
}

function exportEstrattoContoPDF(rows: CorsoEC[], nomeFormatore: string, annoFilter: string, regime: RegimeFiscaleEC, rivalsa: boolean) {
  const fmtCur = (n: number) => `€ ${n.toFixed(2)}`
  const fmtDate = (d: string | null) => d ? [d.slice(8, 10), d.slice(5, 7), d.slice(2, 4)].join('/') : '—'
  const regimeLabel = regime === 'notula' ? 'Prestazione occasionale (ritenuta 20%)'
    : regime === 'forfettario' ? 'Regime forfettario'
    : rivalsa ? 'Regime ordinario + IVA 22%' : 'Regime ordinario'

  const totOre = rows.reduce((s, r) => s + r.ore_erogate, 0)
  const rowsWithTariffa = rows.filter(r => r.tariffa)
  const totImp = rowsWithTariffa.reduce((s, r) => s + r.imponibile, 0)
  const totRit = rowsWithTariffa.reduce((s, r) => s + r.ritenuteIva, 0)
  const totNetto = rowsWithTariffa.reduce((s, r) => s + r.netto, 0)

  const tableRows = rows.map(r => `
    <tr>
      <td>${r.title}</td><td>${r.school_name}</td>
      <td>${[fmtDate(r.prima_sessione), fmtDate(r.ultima_sessione)].filter(x => x !== '—').join(' – ') || '—'}</td>
      <td class="num">${r.ore_erogate}</td>
      <td class="num">${r.tariffa ? `€ ${r.tariffa.toFixed(2)}` : 'N/D'}</td>
      <td class="num">${r.tariffa ? fmtCur(r.imponibile) : '—'}</td>
      <td class="num">${r.tariffa ? (r.ritenuteIva !== 0 ? fmtCur(r.ritenuteIva) : '—') : '—'}</td>
      <td class="num bold">${r.tariffa ? fmtCur(r.netto) : '—'}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Estratto Conto ${nomeFormatore} ${annoFilter}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:20px}
    h1{font-size:16px;margin:0}h2{font-size:12px;font-weight:normal;margin:4px 0 0}
    .header{margin-bottom:16px}
    .meta{margin-bottom:12px;color:#555;font-size:9px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th{background:#f3f4f6;text-align:left;padding:5px 6px;font-size:9px;text-transform:uppercase;border:1px solid #e5e7eb}
    td{padding:4px 6px;border:1px solid #e5e7eb;vertical-align:top}
    .num{text-align:right}.bold{font-weight:bold}
    tr.totale{background:#f9fafb;font-weight:bold}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="header">
    <h1>SVC Consulting Srl</h1>
    <h2>Estratto Conto Formatori</h2>
  </div>
  <div class="meta">
    <strong>Formatore:</strong> ${nomeFormatore} &nbsp;|&nbsp;
    <strong>Anno:</strong> ${annoFilter} &nbsp;|&nbsp;
    <strong>Regime:</strong> ${regimeLabel}
  </div>
  <table>
    <thead><tr>
      <th>Corso</th><th>Scuola</th><th>Periodo</th><th>Ore</th>
      <th>Tariffa</th><th>Imponibile</th><th>Rit./IVA</th><th>Netto</th>
    </tr></thead>
    <tbody>${tableRows}
    <tr class="totale">
      <td colspan="3">TOTALE</td>
      <td class="num">${totOre}</td><td></td>
      <td class="num">${fmtCur(totImp)}</td>
      <td class="num">${totRit !== 0 ? fmtCur(totRit) : '—'}</td>
      <td class="num bold">${fmtCur(totNetto)}</td>
    </tr></tbody>
  </table>
  <script>window.onload=function(){window.print();window.close()}</script>
  </body></html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  if (w) { w.document.write(html); w.document.close() }
}

interface EstrattoContoProps {
  corsiFormatore: CorsoConProgetto[]
  sessionDatesByCorso: Record<string, { prima: string; ultima: string }>
  savedTariffe: {
    tariffa_oraria_formatore: number | null
    regime_fiscale: RegimeFiscaleEC
    rivalsa_iva: boolean
  }
  nomeFormatore: string
}

function EstrattoContoSection({ corsiFormatore, sessionDatesByCorso, savedTariffe, nomeFormatore }: EstrattoContoProps) {
  const [anno, setAnno] = useState(() => String(new Date().getFullYear()))

  const regime = savedTariffe.regime_fiscale
  const rivalsa = savedTariffe.rivalsa_iva

  const allRows = useMemo<CorsoEC[]>(() => {
    return corsiFormatore
      .filter(c => c.corso_completato)
      .map(c => {
        const tariffa = (c.tariffa_oraria != null ? Number(c.tariffa_oraria) : null)
          ?? savedTariffe.tariffa_oraria_formatore
        const dates = sessionDatesByCorso[c.id]
        const prima = dates?.prima ?? null
        const ultima = dates?.ultima ?? null
        const annoVal = c.corso_completato_at?.substring(0, 4) || ultima?.substring(0, 4) || null
        const ore = oreErogateFromC(c)
        const computed = tariffa != null
          ? calcEC(ore, tariffa, regime, rivalsa)
          : { imponibile: 0, ritenuteIva: 0, netto: 0 }
        return {
          corso_id: c.id,
          title: c.title,
          school_name: c.project?.school_name ?? '—',
          ore_erogate: ore,
          tariffa,
          prima_sessione: prima,
          ultima_sessione: ultima,
          anno: annoVal ? Number(annoVal) : null,
          imponibile: computed.imponibile,
          ritenuteIva: computed.ritenuteIva,
          netto: computed.netto,
          regimeFiscale: regime,
          rivalsaIva: rivalsa,
        }
      })
  }, [corsiFormatore, sessionDatesByCorso, savedTariffe, regime, rivalsa])

  const anni = useMemo(() => {
    const s = new Set<string>()
    for (const r of allRows) {
      if (r.anno) s.add(String(r.anno))
    }
    return [...s].sort().reverse()
  }, [allRows])

  const filtered = useMemo(() => {
    if (!anno || anno === 'all') return allRows
    return allRows.filter(r => r.anno === Number(anno))
  }, [allRows, anno])

  const noTariffa = savedTariffe.tariffa_oraria_formatore == null && allRows.every(r => r.tariffa == null)

  const totOre = filtered.reduce((s, r) => s + r.ore_erogate, 0)
  const rowsWithT = filtered.filter(r => r.tariffa != null)
  const totImp = rowsWithT.reduce((s, r) => s + r.imponibile, 0)
  const totRit = rowsWithT.reduce((s, r) => s + r.ritenuteIva, 0)
  const totNetto = rowsWithT.reduce((s, r) => s + r.netto, 0)
  const hasFinancial = rowsWithT.length > 0

  const regimeLabel = regime === 'notula' ? 'Regime: Prestazione occasionale (ritenuta 20%)'
    : regime === 'forfettario' ? 'Regime: Forfettario'
    : rivalsa ? 'Regime: Ordinario + IVA 22%' : 'Regime: Ordinario'

  return (
    <div className="bg-white rounded-xl p-6 mt-6" style={{ border: '0.5px solid #e5e5e5' }}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="font-semibold text-gray-900">Estratto conto</h2>
          <p className="text-sm text-gray-400 mt-0.5">Corsi completati — calcolato sulla tariffa oraria effettiva</p>
        </div>
        {filtered.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => exportEstrattoContoExcel(filtered, nomeFormatore, anno)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Excel
            </button>
            <button
              onClick={() => exportEstrattoContoPDF(filtered, nomeFormatore, anno, regime, rivalsa)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                <polyline points="6 9 6 2 18 2 18 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              PDF
            </button>
          </div>
        )}
      </div>

      {noTariffa && (
        <div className="my-4 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-lg">
          Imposta la tariffa oraria per visualizzare l&apos;estratto conto
        </div>
      )}

      {allRows.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          Nessun corso completato da mostrare.
        </div>
      ) : (
        <>
          {/* Filter row + regime badge */}
          <div className="flex items-center gap-4 mt-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Anno:</span>
              <select
                value={anno}
                onChange={e => setAnno(e.target.value)}
                className="text-sm border border-gray-200 rounded-[7px] px-3 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white"
              >
                <option value="all">Tutti</option>
                {anni.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${
              regime === 'notula' ? 'bg-orange-100 text-orange-700'
              : regime === 'forfettario' ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
            }`}>
              {regimeLabel}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">
              Nessun corso completato per l&apos;anno selezionato.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-400 py-2 pr-4">CORSO</th>
                    <th className="text-left text-xs font-medium text-gray-400 py-2 pr-4">SCUOLA</th>
                    <th className="text-left text-xs font-medium text-gray-400 py-2 pr-4">PERIODO</th>
                    <th className="text-right text-xs font-medium text-gray-400 py-2 pr-4">ORE</th>
                    <th className="text-right text-xs font-medium text-gray-400 py-2 pr-4">TARIFFA</th>
                    <th className="text-right text-xs font-medium text-gray-400 py-2 pr-4">IMPONIBILE</th>
                    <th className="text-right text-xs font-medium text-gray-400 py-2 pr-4">RITENUTA/IVA</th>
                    <th className="text-right text-xs font-medium text-gray-400 py-2">NETTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(r => {
                    const p1 = fmtDateShortEC(r.prima_sessione)
                    const p2 = fmtDateShortEC(r.ultima_sessione)
                    const periodo = p1 ? (p2 && p2 !== p1 ? `${p1} – ${p2}` : p1) : '—'
                    return (
                      <tr key={r.corso_id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 text-gray-900 font-medium">{r.title}</td>
                        <td className="py-3 pr-4 text-gray-600">{r.school_name}</td>
                        <td className="py-3 pr-4 text-xs text-gray-500 whitespace-nowrap">{periodo}</td>
                        <td className="py-3 pr-4 text-right text-gray-700">{r.ore_erogate}h</td>
                        <td className="py-3 pr-4 text-right font-mono text-gray-700">
                          {r.tariffa != null ? `€ ${r.tariffa.toFixed(2)}/h` : <span className="text-gray-300">N/D</span>}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono text-gray-700">
                          {r.tariffa != null ? fmtCurrency(r.imponibile) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono">
                          {r.tariffa != null
                            ? r.ritenuteIva === 0
                              ? <span className="text-gray-300">–</span>
                              : r.ritenuteIva < 0
                                ? <span className="text-red-600">-{fmtCurrency(-r.ritenuteIva)} (20%)</span>
                                : <span className="text-green-700">+{fmtCurrency(r.ritenuteIva)} (IVA 22%)</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="py-3 text-right font-mono font-semibold text-gray-900">
                          {r.tariffa != null ? fmtCurrency(r.netto) : <span className="text-gray-300 font-normal">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={3} className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">TOTALE</td>
                    <td className="py-3 pr-4 text-right font-mono text-gray-900">{totOre}h</td>
                    <td className="py-3 pr-4"></td>
                    <td className="py-3 pr-4 text-right font-mono text-gray-900">
                      {hasFinancial ? fmtCurrency(totImp) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono">
                      {hasFinancial
                        ? totRit === 0
                          ? <span className="text-gray-300">–</span>
                          : totRit < 0
                            ? <span className="text-red-600">-{fmtCurrency(-totRit)}</span>
                            : <span className="text-green-700">+{fmtCurrency(totRit)}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-gray-900">
                      {hasFinancial ? fmtCurrency(totNetto) : <span className="text-gray-300 font-normal">—</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function oreErogateFromC(c: CorsoConProgetto): number {
  // Use ore_erogate from the CorsoConOre view if available
  return Number((c as CorsoConOre).ore_erogate ?? 0)
}
