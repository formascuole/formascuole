'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'
import { UserRole } from '@/lib/types'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth'
import type { UtenteStats } from '@/app/api/utenti/stats/route'

interface UtenteConStats {
  id: string
  nome: string
  email: string
  avatar_initials: string
  role: UserRole
  roles: UserRole[]
  profilo_completo?: boolean | null
  tariffa_oraria_formatore?: number | null
  // Formatore stats
  n_corsi_formatore: number
  ore_formatore: number
  // Tutor stats
  n_corsi_tutor: number
  ore_tutor: number
  // Overall
  pct: number
}

interface FormatoriClientProps {
  utenti: UtenteConStats[]
  isSuperAdmin: boolean
}

const SELECTABLE_ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'formatore', label: 'Formatore', desc: 'Può gestire i propri corsi e il calendario' },
  { value: 'tutor', label: 'Tutor', desc: 'Può visualizzare e annotare i corsi assegnati' },
  { value: 'admin', label: 'Admin', desc: 'Accesso completo alla piattaforma' },
]

const initialCreateForm = { nome: '', email: '', password: '', roles: ['formatore'] as UserRole[] }

type EditForm = { nome: string; roles: UserRole[] }

export function FormatoriClient({ utenti, isSuperAdmin }: FormatoriClientProps) {
  const router = useRouter()

  // --- Create state ---
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(initialCreateForm)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  // --- Edit state ---
  const [editTarget, setEditTarget] = useState<UtenteConStats | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ nome: '', roles: [] })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState('')

  const [search, setSearch] = useState('')
  const [statsMap, setStatsMap] = useState<Record<string, UtenteStats>>({})
  const [statsLoading, setStatsLoading] = useState(true)

  // --- Delete state ---
  const [deleteTarget, setDeleteTarget] = useState<UtenteConStats | null>(null)

  // --- Reinvia credenziali state ---
  const [reinviaTarget, setReinviaTarget] = useState<UtenteConStats | null>(null)
  const [reinviando, setReinviando] = useState(false)
  const [reinviaError, setReinviaError] = useState('')
  const [reinviaSuccessId, setReinviaSuccessId] = useState<string | null>(null)

  // Fetch stats client-side via service-role API to bypass RLS
  useEffect(() => {
    fetch('/api/utenti/stats')
      .then(r => r.json())
      .then(data => { setStatsMap(data); setStatsLoading(false) })
      .catch(() => setStatsLoading(false))
  }, [])

  const visibleRoles = SELECTABLE_ROLES.filter(r => r.value !== 'admin' || isSuperAdmin)

  const filtered = useMemo(() => {
    if (!search.trim()) return utenti
    const q = search.toLowerCase()
    return utenti.filter(u =>
      u.nome.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.roles || [u.role]).some(r => ROLE_LABELS[r as UserRole]?.toLowerCase().includes(q))
    )
  }, [utenti, search])

  // ─── Create handlers ───────────────────────────────────────────────────────
  const handleCloseCreate = () => {
    setCreateOpen(false)
    setCreateForm(initialCreateForm)
    setCreateError('')
    setCreateSuccess('')
  }

  const toggleCreateRole = (role: UserRole) => {
    setCreateForm(f => {
      if (f.roles.includes(role)) {
        if (f.roles.length === 1) return f
        return { ...f, roles: f.roles.filter(r => r !== role) }
      }
      return { ...f, roles: [...f.roles, role] }
    })
  }

  const handleCreate = async () => {
    setCreateError('')
    setCreating(true)
    try {
      const res = await fetch('/api/formatori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: createForm.nome,
          email: createForm.email,
          password: createForm.password,
          roles: createForm.roles,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCreateError(json.error || 'Errore durante la creazione')
        return
      }
      const roleLabel = createForm.roles.map(r => ROLE_LABELS[r]).join(', ')
      setCreateSuccess(`Utente "${createForm.nome}" (${roleLabel}) creato con successo!`)
      setCreateForm(initialCreateForm)
      router.refresh()
    } finally {
      setCreating(false)
    }
  }

  const canCreate = createForm.nome.trim() && createForm.email.trim() && createForm.password.length >= 6 && createForm.roles.length > 0

  // ─── Edit handlers ─────────────────────────────────────────────────────────
  const openEdit = (u: UtenteConStats) => {
    setEditTarget(u)
    setEditForm({
      nome: u.nome,
      // Only include editable roles (filter out super_admin if present)
      roles: (u.roles || [u.role]).filter(r => r !== 'super_admin') as UserRole[],
    })
    setEditError('')
    setEditSuccess('')
  }

  const handleCloseEdit = () => {
    setEditTarget(null)
    setEditForm({ nome: '', roles: [] })
    setEditError('')
    setEditSuccess('')
  }

  const toggleEditRole = (role: UserRole) => {
    setEditForm(f => {
      if (f.roles.includes(role)) {
        if (f.roles.length === 1) return f
        return { ...f, roles: f.roles.filter(r => r !== role) }
      }
      return { ...f, roles: [...f.roles, role] }
    })
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return
    setEditError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/formatori/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editForm.nome, roles: editForm.roles }),
      })
      const json = await res.json()
      if (!res.ok) {
        setEditError(json.error || 'Errore durante il salvataggio')
        return
      }
      setEditSuccess(`Modifiche salvate per "${editForm.nome}".`)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const canSave = editForm.nome.trim().length > 0 && editForm.roles.length > 0

  const handleReinvia = async () => {
    if (!reinviaTarget) return
    setReinviando(true)
    setReinviaError('')
    try {
      const res = await fetch(`/api/utenti/${reinviaTarget.id}/reinvia-credenziali`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setReinviaError(json.error || 'Errore'); return }
      const sentId = reinviaTarget.id
      setReinviaTarget(null)
      setReinviaSuccessId(sentId)
      setTimeout(() => setReinviaSuccessId(null), 3000)
    } finally {
      setReinviando(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utenti</h1>
          <p className="text-sm text-gray-500 mt-1">{utenti.length} utenti registrati</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Aggiungi Utente
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" fill="none" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per nome, email o ruolo..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-[7px] focus:outline-none focus:border-[#d64b55] transition-colors bg-white"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">UTENTE</th>
              <th className="text-left text-xs font-medium text-gray-400 px-3 py-3">RUOLO</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-3">C.FORM.</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-3">ORE</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-3">C.TUTOR</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-3">ORE</th>
              <th className="text-left text-xs font-medium text-gray-400 px-3 py-3 min-w-[110px]">PIANIF. %</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-3">ACCETT. %</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-3">PROFILO</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/utenti/${u.id}`} className="flex items-center gap-2.5 group">
                    <Avatar nome={u.nome} id={u.id} initials={u.avatar_initials} size="md" />
                    <div>
                      <div className="font-medium text-sm text-gray-900 group-hover:text-[#d64b55] transition-colors">{u.nome}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(u.roles || [u.role]).filter(r => r !== 'super_admin').map(r => (
                      <span key={r} className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${ROLE_COLORS[r as UserRole]}`}>
                        {ROLE_LABELS[r as UserRole]}
                      </span>
                    ))}
                  </div>
                </td>
                {statsLoading ? (
                  <>
                    <td className="px-2 py-3 text-center"><span className="inline-block w-6 h-3 bg-gray-100 rounded animate-pulse" /></td>
                    <td className="px-2 py-3 text-center"><span className="inline-block w-8 h-3 bg-gray-100 rounded animate-pulse" /></td>
                    <td className="px-2 py-3 text-center"><span className="inline-block w-6 h-3 bg-gray-100 rounded animate-pulse" /></td>
                    <td className="px-2 py-3 text-center"><span className="inline-block w-8 h-3 bg-gray-100 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><span className="inline-block w-16 h-3 bg-gray-100 rounded animate-pulse" /></td>
                    <td className="px-2 py-3 text-center"><span className="inline-block w-10 h-3 bg-gray-100 rounded animate-pulse" /></td>
                  </>
                ) : (() => {
                  const s = statsMap[u.id]
                  const nF = s?.n_corsi_formatore ?? 0
                  const oF = s?.ore_formatore ?? 0
                  const nT = s?.n_corsi_tutor ?? 0
                  const oT = s?.ore_tutor ?? 0
                  const pct = s?.pct ?? 0
                  return (
                    <>
                      <td className="px-2 py-3 text-center text-sm text-gray-700">
                        {nF > 0 ? <span className="font-medium">{nF}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-3 text-center text-sm text-gray-700">
                        {oF > 0 ? <span>{oF}h</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-3 text-center text-sm text-gray-700">
                        {nT > 0 ? <span className="font-medium">{nT}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-3 text-center text-sm text-gray-700">
                        {oT > 0 ? <span>{oT}h</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        {(nF + nT) > 0 ? (
                          <ProgressBar value={pct} size="sm" showLabel />
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center text-sm text-gray-700">
                        {(() => {
                          const ta = s?.tasso_accettazione
                          if (ta === null || ta === undefined) return <span className="text-gray-300">—</span>
                          const color = ta >= 80 ? 'text-green-700' : ta >= 50 ? 'text-amber-600' : 'text-red-600'
                          return <span className={`font-medium ${color}`}>{ta}%</span>
                        })()}
                      </td>
                    </>
                  )
                })()}
                <td className="px-2 py-3 text-center">
                  {(u.roles || [u.role]).includes('formatore') ? (() => {
                    if (u.profilo_completo && u.tariffa_oraria_formatore != null) {
                      return (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-green-100 text-green-700">
                          <svg width="9" height="9" fill="none" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                          Completo
                        </span>
                      )
                    }
                    if (u.profilo_completo) {
                      return (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                          Manca tariffa
                        </span>
                      )
                    }
                    return (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                        Incompleto
                      </span>
                    )
                  })() : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(u)}
                      className="p-1.5 rounded-[7px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="Modifica"
                    >
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => { setReinviaTarget(u); setReinviaError('') }}
                      className={`p-1.5 rounded-[7px] transition-colors ${reinviaSuccessId === u.id ? 'text-green-500 bg-green-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                      title="Reinvia credenziali"
                    >
                      {reinviaSuccessId === u.id ? (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                          <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                    </button>
                    {isSuperAdmin && !(u.roles || [u.role]).includes('super_admin') && (
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="p-1.5 rounded-[7px] text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Elimina"
                      >
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                          <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-sm text-gray-400">
                  {search ? 'Nessun utente trovato per questa ricerca' : 'Nessun utente registrato'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal: Crea utente ──────────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        onClose={handleCloseCreate}
        title="Aggiungi Utente"
        size="sm"
        footer={
          createSuccess ? (
            <Button onClick={handleCloseCreate}>Chiudi</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={handleCloseCreate}>Annulla</Button>
              <Button onClick={handleCreate} loading={creating} disabled={!canCreate}>
                Crea Account
              </Button>
            </>
          )
        }
      >
        {createSuccess ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-[7px] px-4 py-3">
              <svg className="text-green-500 shrink-0 mt-0.5" width="16" height="16" fill="none" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-sm text-green-800">{createSuccess}</p>
            </div>
            <p className="text-sm text-gray-500">
              L&apos;utente può accedere alla piattaforma con le credenziali fornite.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Nome completo *"
              placeholder="Es. Mario Rossi"
              value={createForm.nome}
              onChange={e => setCreateForm(f => ({ ...f, nome: e.target.value }))}
              autoComplete="off"
            />
            <Input
              label="Email *"
              type="email"
              placeholder="mario.rossi@esempio.it"
              value={createForm.email}
              onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
              autoComplete="off"
            />
            <Input
              label="Password temporanea *"
              type="password"
              placeholder="Minimo 6 caratteri"
              value={createForm.password}
              onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
              hint="L'utente dovrà cambiarla al primo accesso"
              autoComplete="new-password"
            />
            <RoleCheckboxes
              selected={createForm.roles}
              onToggle={toggleCreateRole}
              visibleRoles={visibleRoles}
              isSuperAdmin={isSuperAdmin}
            />
            {createError && <ErrorBanner message={createError} />}
          </div>
        )}
      </Modal>

      {/* ── Modal: Modifica utente ──────────────────────────────────────────── */}
      <Modal
        open={!!editTarget}
        onClose={handleCloseEdit}
        title={editTarget ? `Modifica — ${editTarget.nome}` : ''}
        size="sm"
        footer={
          editSuccess ? (
            <Button onClick={handleCloseEdit}>Chiudi</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={handleCloseEdit}>Annulla</Button>
              <Button onClick={handleSaveEdit} loading={saving} disabled={!canSave}>
                Salva modifiche
              </Button>
            </>
          )
        }
      >
        {editSuccess ? (
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-[7px] px-4 py-3">
            <svg className="text-green-500 shrink-0 mt-0.5" width="16" height="16" fill="none" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm text-green-800">{editSuccess}</p>
          </div>
        ) : editTarget ? (
          <div className="space-y-4">
            <Input
              label="Nome completo *"
              value={editForm.nome}
              onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))}
              autoComplete="off"
            />
            {/* Email: read-only */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Email</div>
              <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-[7px] px-3 py-2 select-all">
                {editTarget.email}
              </div>
              <p className="text-xs text-gray-400 mt-1">L&apos;email non può essere modificata da qui.</p>
            </div>
            <RoleCheckboxes
              selected={editForm.roles}
              onToggle={toggleEditRole}
              visibleRoles={visibleRoles}
              isSuperAdmin={isSuperAdmin}
            />
            {editError && <ErrorBanner message={editError} />}
          </div>
        ) : null}
      </Modal>

      {/* ── Modal: Elimina utente ────────────────────────────────────────────── */}
      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={`Elimina utente — ${deleteTarget?.nome ?? ''}`}
        description={`Sei sicuro di voler eliminare ${deleteTarget?.nome}? Questa azione è irreversibile. I corsi assegnati a questo utente rimarranno ma perderanno il riferimento al formatore/tutor.`}
        confirmName={deleteTarget?.nome ?? ''}
        onConfirm={async () => {
          const res = await fetch(`/api/formatori/${deleteTarget!.id}`, { method: 'DELETE' })
          if (!res.ok) {
            const json = await res.json()
            throw new Error(json.error || 'Errore durante l\'eliminazione')
          }
          setDeleteTarget(null)
          router.refresh()
        }}
      />

      {/* Reinvia credenziali modal */}
      <Modal
        open={!!reinviaTarget}
        onClose={() => setReinviaTarget(null)}
        title="Reinvia credenziali"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReinviaTarget(null)}>Annulla</Button>
            <Button onClick={handleReinvia} loading={reinviando}>Conferma</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Vuoi reinviare le credenziali di accesso a{' '}
            <span className="font-semibold">{reinviaTarget?.nome}</span>{' '}
            (<span className="text-gray-500">{reinviaTarget?.email}</span>)?
          </p>
          <p className="text-xs text-gray-400">
            Verrà generata una nuova password temporanea e inviata via email. La password attuale dell&apos;utente verrà sostituita.
          </p>
          {reinviaError && <p className="text-sm text-red-600">{reinviaError}</p>}
        </div>
      </Modal>
    </div>
  )
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function RoleCheckboxes({
  selected,
  onToggle,
  visibleRoles,
  isSuperAdmin,
}: {
  selected: UserRole[]
  onToggle: (r: UserRole) => void
  visibleRoles: typeof SELECTABLE_ROLES
  isSuperAdmin: boolean
}) {
  return (
    <div>
      <div className="text-sm font-medium text-gray-700 mb-2">Ruolo/i *</div>
      <div className="space-y-2">
        {visibleRoles.map(({ value, label, desc }) => {
          const checked = selected.includes(value)
          return (
            <label
              key={value}
              className="flex items-start gap-3 p-3 rounded-[7px] border cursor-pointer transition-all"
              style={{
                borderColor: checked ? '#d64b55' : '#e5e5e5',
                backgroundColor: checked ? '#fbeced' : 'white',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(value)}
                className="mt-0.5 accent-[#d64b55]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${ROLE_COLORS[value]}`}>
                    {label}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
              </div>
            </label>
          )
        })}
      </div>
      {!isSuperAdmin && (
        <p className="text-xs text-gray-400 mt-2">
          Solo il Super Admin può assegnare il ruolo Admin.
        </p>
      )}
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2">
      <svg className="shrink-0 mt-0.5" width="14" height="14" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      {message}
    </div>
  )
}
