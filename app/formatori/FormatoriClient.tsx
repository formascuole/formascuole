'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { DualProgressBar } from '@/components/ui/DualProgressBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'
import { UserRole } from '@/lib/types'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth'
import type { UtenteStats } from '@/app/api/utenti/stats/route'
import { PROVINCE_BY_REGIONE, REGIONI } from '@/lib/geo-data'

interface UtenteConStats {
  id: string
  nome: string
  email: string
  avatar_initials: string
  role: UserRole
  roles: UserRole[]
  profilo_completo?: boolean | null
  tariffa_oraria_formatore?: number | null
  tariffa_oraria_tutor?: number | null
  created_at?: string
  // Fiscal / profile
  luogo_nascita?: string | null
  data_nascita?: string | null
  codice_fiscale?: string | null
  indirizzo_via?: string | null
  indirizzo_cap?: string | null
  indirizzo_citta?: string | null
  indirizzo_provincia?: string | null
  regione?: string | null
  iban?: string | null
  banca?: string | null
  intestatario_conto?: string | null
  ha_partita_iva?: boolean | null
  regime_fiscale?: string | null
  rivalsa_iva?: boolean | null
  partita_iva?: string | null
  telefono?: string | null
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

const REGIME_EXPORT_LABELS: Record<string, string> = {
  forfettario: 'Forfettario',
  ordinario:   'Ordinario',
  notula:      'Prestazione occasionale',
}

async function exportFormatori(utenti: UtenteConStats[], statsMap: Record<string, UtenteStats>) {
  const XLSX = await import('xlsx')
  const headers = [
    'Nome completo', 'Email', 'Telefono', 'Ruolo',
    'Profilo completo', 'Regime fiscale', 'Partita IVA',
    'Tariffa formatore (€/h)', 'Tariffa tutor (€/h)',
    'Luogo di nascita', 'Data di nascita', 'Codice fiscale',
    'Via', 'CAP', 'Città', 'Prov.',
    'IBAN', 'Banca', 'Intestatario conto',
    'N. corsi (form.)', 'Ore formatore',
    'N. corsi (tutor)', 'Ore tutor',
    '% pianificazione', '% accettazione',
    'Data creazione',
  ]

  const rows = utenti
    .filter(u => (u.roles || [u.role]).some(r => r === 'formatore' || r === 'tutor'))
    .map(u => {
      const s = statsMap[u.id]
      const ruolo = (u.roles || [u.role])
        .filter(r => r === 'formatore' || r === 'tutor')
        .map(r => r === 'formatore' ? 'Formatore' : 'Tutor')
        .join(' / ')
      const regime = u.ha_partita_iva
        ? (REGIME_EXPORT_LABELS[u.regime_fiscale || ''] || u.regime_fiscale || '')
        : 'Prestazione occasionale'
      return [
        u.nome,
        u.email,
        u.telefono || '',
        ruolo,
        u.profilo_completo ? 'Sì' : 'No',
        regime,
        u.ha_partita_iva ? (u.partita_iva || '') : '',
        u.tariffa_oraria_formatore ?? '',
        u.tariffa_oraria_tutor ?? '',
        u.luogo_nascita || '',
        u.data_nascita ? new Date(u.data_nascita).toLocaleDateString('it-IT') : '',
        u.codice_fiscale || '',
        u.indirizzo_via || '',
        u.indirizzo_cap || '',
        u.indirizzo_citta || '',
        u.indirizzo_provincia || '',
        u.iban || '',
        u.banca || '',
        u.intestatario_conto || '',
        s?.n_corsi_formatore ?? 0,
        s?.ore_formatore ?? 0,
        s?.n_corsi_tutor ?? 0,
        s?.ore_tutor ?? 0,
        s?.pct != null ? `${s.pct}%` : '',
        s?.tasso_accettazione != null ? `${s.tasso_accettazione}%` : '',
        u.created_at ? new Date(u.created_at).toLocaleDateString('it-IT') : '',
      ]
    })

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Auto column widths
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(Math.max(
      h.length,
      ...rows.map(r => String(r[i] ?? '').length)
    ) + 2, 40),
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Formatori')
  const today = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `Formatori_Formascuole_${today}.xlsx`)
}

const initialCreateForm = { nome: '', email: '', ruolo: 'formatore' as UserRole, tariffa: '' }

type EditForm = { nome: string; roles: UserRole[] }

export function FormatoriClient({ utenti, isSuperAdmin }: FormatoriClientProps) {
  const router = useRouter()

  // --- Create state ---
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(initialCreateForm)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [passwordCopied, setPasswordCopied] = useState(false)

  // --- Edit state ---
  const [editTarget, setEditTarget] = useState<UtenteConStats | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ nome: '', roles: [] })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState('')

  const [search, setSearch] = useState('')
  const [filterProfilo, setFilterProfilo] = useState<'all' | 'completo' | 'manca_tariffa' | 'incompleto'>('all')
  const [filterRegione, setFilterRegione] = useState('')
  const [filterProvincia, setFilterProvincia] = useState('')
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

  const provinceOptions = useMemo(() => {
    if (!filterRegione) return []
    return (PROVINCE_BY_REGIONE[filterRegione] ?? []).map(p => p.codice).sort()
  }, [filterRegione])

  const filtered = useMemo(() => {
    let result = utenti
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(u =>
        u.nome.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.roles || [u.role]).some(r => ROLE_LABELS[r as UserRole]?.toLowerCase().includes(q))
      )
    }
    if (filterProfilo !== 'all') {
      result = result.filter(u => {
        const roles = u.roles || [u.role]
        const isFormatore = roles.includes('formatore')
        const tariffa = isFormatore ? u.tariffa_oraria_formatore : u.tariffa_oraria_tutor
        if (filterProfilo === 'completo') return u.profilo_completo === true && tariffa != null
        if (filterProfilo === 'manca_tariffa') return u.profilo_completo === true && tariffa == null
        if (filterProfilo === 'incompleto') return u.profilo_completo !== true
        return true
      })
    }
    if (filterRegione) {
      result = result.filter(u => u.regione === filterRegione)
    }
    if (filterProvincia) {
      result = result.filter(u => u.indirizzo_provincia === filterProvincia)
    }
    return result
  }, [utenti, search, filterProfilo, filterRegione, filterProvincia])

  // ─── Create handlers ───────────────────────────────────────────────────────
  const handleCloseCreate = () => {
    setCreateOpen(false)
    setCreateForm(initialCreateForm)
    setCreateError('')
    setCreateSuccess('')
    setGeneratedPassword('')
    setPasswordCopied(false)
  }

  const handleCreate = async () => {
    setCreateError('')
    setCreating(true)
    try {
      const res = await fetch('/api/admin/crea-utente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: createForm.nome,
          email: createForm.email,
          ruolo: createForm.ruolo,
          ...(createForm.ruolo === 'formatore' && { tariffa_oraria_formatore: Number(createForm.tariffa) }),
          ...(createForm.ruolo === 'tutor' && { tariffa_oraria_tutor: Number(createForm.tariffa) }),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCreateError(json.error || 'Errore durante la creazione')
        return
      }
      setGeneratedPassword(json.password ?? '')
      setCreateSuccess(`Utente "${createForm.nome}" creato con successo.`)
      setCreateForm(initialCreateForm)
      router.refresh()
    } finally {
      setCreating(false)
    }
  }

  const handleCopyPassword = () => {
    if (!generatedPassword) return
    navigator.clipboard.writeText(generatedPassword).then(() => {
      setPasswordCopied(true)
      setTimeout(() => setPasswordCopied(false), 2000)
    })
  }

  const needsTariffa = createForm.ruolo === 'formatore' || createForm.ruolo === 'tutor'
  const canCreate = createForm.nome.trim().length > 0
    && createForm.email.trim().length > 0
    && !!createForm.ruolo
    && (!needsTariffa || Number(createForm.tariffa) > 0)

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportFormatori(utenti, statsMap)}
            disabled={statsLoading}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-40"
            title="Esporta Excel"
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Esporta Excel
          </button>
          <Button onClick={() => setCreateOpen(true)}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Aggiungi Utente
          </Button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
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
        <select
          value={filterProfilo}
          onChange={e => setFilterProfilo(e.target.value as typeof filterProfilo)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-[7px] focus:outline-none focus:border-[#d64b55] transition-colors bg-white"
        >
          <option value="all">Stato profilo: tutti</option>
          <option value="completo">✅ Completo</option>
          <option value="manca_tariffa">🟠 Manca tariffa</option>
          <option value="incompleto">🔴 Incompleto</option>
        </select>
        <select
          value={filterRegione}
          onChange={e => { setFilterRegione(e.target.value); setFilterProvincia('') }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-[7px] focus:outline-none focus:border-[#d64b55] transition-colors bg-white"
        >
          <option value="">Tutte le regioni</option>
          {REGIONI.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={filterProvincia}
          onChange={e => setFilterProvincia(e.target.value)}
          disabled={!filterRegione}
          className="px-3 py-2 text-sm border border-gray-200 rounded-[7px] focus:outline-none focus:border-[#d64b55] transition-colors bg-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <option value="">Tutte le province</option>
          {provinceOptions.map(codice => <option key={codice} value={codice}>{codice}</option>)}
        </select>
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
                          <DualProgressBar oreTotali={s?.ore_totale ?? 0} orePianificate={s?.ore_pianificate ?? 0} oreErogate={s?.ore_erogate ?? 0} size="sm" />
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
            {generatedPassword && (
              <div className="rounded-[7px] border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Password temporanea generata</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-white border border-amber-200 rounded px-3 py-1.5 text-gray-800 select-all">
                    {generatedPassword}
                  </code>
                  <button
                    onClick={handleCopyPassword}
                    className="shrink-0 p-1.5 rounded text-amber-600 hover:bg-amber-100 transition-colors"
                    title="Copia password"
                  >
                    {passwordCopied ? (
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                        <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-amber-600">
                  Comunica questa password all&apos;utente. Verrà anche inviata via email.
                </p>
              </div>
            )}
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
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Ruolo *</div>
              <div className="space-y-2">
                {visibleRoles.map(({ value, label, desc }) => {
                  const checked = createForm.ruolo === value
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
                        type="radio"
                        name="ruolo"
                        checked={checked}
                        onChange={() => setCreateForm(f => ({ ...f, ruolo: value, tariffa: '' }))}
                        className="mt-0.5 accent-[#d64b55]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{label}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${ROLE_COLORS[value]}`}>{label}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                La password temporanea verrà generata automaticamente e inviata via email.
              </p>
            </div>
            {needsTariffa && (
              <Input
                label={createForm.ruolo === 'formatore' ? 'Tariffa come formatore (€/h) *' : 'Tariffa come tutor (€/h) *'}
                type="number"
                min="1"
                step="0.5"
                placeholder="es. 40.00"
                value={createForm.tariffa}
                onChange={e => setCreateForm(f => ({ ...f, tariffa: e.target.value }))}
              />
            )}
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
        confirmName="CANCELLA"
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
