'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { generateAvatarColor } from '@/lib/utils'

interface AccountClientProps {
  nome: string
  email: string
  avatarInitials: string
  createdAt: string
}

export function AccountClient({ nome, email, avatarInitials, createdAt }: AccountClientProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const passwordError =
    newPassword.length > 0 && newPassword.length < 8
      ? 'Minimo 8 caratteri'
      : confirmPassword.length > 0 && newPassword !== confirmPassword
      ? 'Le password non corrispondono'
      : ''

  const canSave = newPassword.length >= 8 && newPassword === confirmPassword

  const handleClose = () => {
    setModalOpen(false)
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setSuccess(false)
  }

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } finally {
      setSaving(false)
    }
  }

  const bgColor = generateAvatarColor(avatarInitials)
  const joinDate = createdAt
    ? new Date(createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Il mio account</h1>
        <p className="text-sm text-gray-500 mt-1">Gestisci le informazioni del tuo profilo</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-center gap-5">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0 ${bgColor}`}
          >
            {avatarInitials}
          </div>
          <div>
            <div className="text-xl font-semibold text-gray-900">{nome}</div>
            <div className="text-sm text-gray-500 mt-0.5">{email}</div>
            <div className="text-xs text-gray-400 mt-1">Account creato il {joinDate}</div>
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <h2 className="font-semibold text-gray-900 mb-4">Informazioni account</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Nome completo</span>
            <span className="text-sm font-medium text-gray-900">{nome}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-medium text-gray-900">{email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Ruolo</span>
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-purple-100 text-purple-700">
              Formatore
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">Password</span>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Cambia password
            </Button>
          </div>
        </div>
      </div>

      {/* Change password modal */}
      <Modal
        open={modalOpen}
        onClose={handleClose}
        title="Cambia password"
        size="sm"
        footer={
          success ? (
            <Button onClick={handleClose}>Chiudi</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={handleClose}>Annulla</Button>
              <Button onClick={handleSave} loading={saving} disabled={!canSave}>
                Salva password
              </Button>
            </>
          )
        }
      >
        {success ? (
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-[7px] px-4 py-3">
            <svg className="text-green-500 shrink-0 mt-0.5" width="16" height="16" fill="none" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <p className="text-sm font-medium text-green-800">Password aggiornata!</p>
              <p className="text-xs text-green-700 mt-0.5">
                Usa la nuova password al prossimo accesso.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Scegli una password sicura di almeno 8 caratteri.
            </p>
            <Input
              label="Nuova password *"
              type="password"
              placeholder="Minimo 8 caratteri"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setError('') }}
              error={newPassword.length > 0 && newPassword.length < 8 ? 'Minimo 8 caratteri' : ''}
              autoComplete="new-password"
            />
            <Input
              label="Conferma nuova password *"
              type="password"
              placeholder="Ripeti la password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError('') }}
              error={
                confirmPassword.length > 0 && newPassword !== confirmPassword
                  ? 'Le password non corrispondono'
                  : ''
              }
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
