'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { UserRole } from '@/lib/types'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/auth'

interface UtenteConStats {
  id: string
  nome: string
  email: string
  avatar_initials: string
  role: UserRole
  n_corsi: number
  oreTotali: number
  orePianificate: number
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

const initialForm = { nome: '', email: '', password: '', roles: ['formatore'] as UserRole[] }

export function FormatoriClient({ utenti, isSuperAdmin }: FormatoriClientProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleClose = () => {
    setModalOpen(false)
    setForm(initialForm)
    setError('')
    setSuccess('')
  }

  const toggleRole = (role: UserRole) => {
    setForm(f => {
      if (f.roles.includes(role)) {
        // Always keep at least one role
        if (f.roles.length === 1) return f
        return { ...f, roles: f.roles.filter(r => r !== role) }
      }
      return { ...f, roles: [...f.roles, role] }
    })
  }

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/formatori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          password: form.password,
          roles: form.roles,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Errore durante la creazione')
        return
      }
      const roleLabel = form.roles.map(r => ROLE_LABELS[r]).join(', ')
      setSuccess(`Utente "${form.nome}" (${roleLabel}) creato con successo!`)
      setForm(initialForm)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = form.nome.trim() && form.email.trim() && form.password.length >= 6 && form.roles.length > 0

  const visibleRoles = SELECTABLE_ROLES.filter(r => r.value !== 'admin' || isSuperAdmin)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utenti</h1>
          <p className="text-sm text-gray-500 mt-1">{utenti.length} utenti registrati</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Aggiungi Utente
        </Button>
      </div>

      <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">UTENTE</th>
              <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">RUOLO</th>
              <th className="text-center text-xs font-medium text-gray-400 px-6 py-3">CORSI</th>
              <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">ORE TOTALI</th>
              <th className="text-left text-xs font-medium text-gray-400 px-6 py-3 min-w-[180px]">PIANIFICATO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {utenti.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar nome={u.nome} id={u.id} initials={u.avatar_initials} size="md" />
                    <div>
                      <div className="font-medium text-sm text-gray-900">{u.nome}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md ${ROLE_COLORS[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-6 py-4 text-center text-sm font-medium text-gray-700">{u.n_corsi}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{u.oreTotali}h</td>
                <td className="px-6 py-4">
                  {u.oreTotali > 0 ? (
                    <div className="space-y-1">
                      <ProgressBar value={u.pct} size="sm" showLabel />
                      <div className="text-xs text-gray-400">{u.orePianificate}h / {u.oreTotali}h</div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {utenti.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                  Nessun utente registrato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal aggiungi utente */}
      <Modal
        open={modalOpen}
        onClose={handleClose}
        title="Aggiungi Utente"
        size="sm"
        footer={
          success ? (
            <Button onClick={handleClose}>Chiudi</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={handleClose}>Annulla</Button>
              <Button onClick={handleSave} loading={saving} disabled={!canSubmit}>
                Crea Account
              </Button>
            </>
          )
        }
      >
        {success ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-[7px] px-4 py-3">
              <svg className="text-green-500 shrink-0 mt-0.5" width="16" height="16" fill="none" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-sm text-green-800">{success}</p>
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
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              autoComplete="off"
            />
            <Input
              label="Email *"
              type="email"
              placeholder="mario.rossi@esempio.it"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              autoComplete="off"
            />
            <Input
              label="Password temporanea *"
              type="password"
              placeholder="Minimo 6 caratteri"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              hint="L'utente dovrà cambiarla al primo accesso"
              autoComplete="new-password"
            />

            {/* Role selection */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Ruolo/i *</div>
              <div className="space-y-2">
                {visibleRoles.map(({ value, label, desc }) => {
                  const checked = form.roles.includes(value)
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
                        onChange={() => toggleRole(value)}
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
                  Solo il Super Admin può creare account Admin.
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2">
                <svg className="shrink-0 mt-0.5" width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
