'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'

interface FormatoreConStats {
  id: string
  nome: string
  email: string
  avatar_initials: string
  n_corsi: number
  oreTotali: number
  orePianificate: number
  pct: number
}

interface FormatoriClientProps {
  formatoriConStats: FormatoreConStats[]
}

const initialForm = { nome: '', email: '', password: '' }

export function FormatoriClient({ formatoriConStats }: FormatoriClientProps) {
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

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/formatori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Errore durante la creazione')
        return
      }
      setSuccess(`Formatore "${form.nome}" creato con successo!`)
      setForm(initialForm)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = form.nome.trim() && form.email.trim() && form.password.length >= 6

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formatori</h1>
          <p className="text-sm text-gray-500 mt-1">{formatoriConStats.length} formatori registrati</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Aggiungi Formatore
        </Button>
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
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-400">
                  Nessun formatore registrato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal aggiungi formatore */}
      <Modal
        open={modalOpen}
        onClose={handleClose}
        title="Aggiungi Formatore"
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
              Il formatore può accedere alla piattaforma con le credenziali fornite.
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
              hint="Il formatore dovrà cambiarla al primo accesso"
              autoComplete="new-password"
            />
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
