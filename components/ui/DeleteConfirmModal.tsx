'use client'
import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface DeleteConfirmModalProps {
  open: boolean
  onClose: () => void
  title: string
  description: string
  /** Exact string the user must type to enable the confirm button */
  confirmName: string
  /** Label shown above the input field (defaults to confirmName) */
  confirmLabel?: string
  onConfirm: () => Promise<void>
}

export function DeleteConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmName,
  confirmLabel,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [input, setInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const matches = input.trim() === confirmName.trim()

  const handleClose = () => {
    if (deleting) return
    setInput('')
    setError('')
    onClose()
  }

  const handleConfirm = async () => {
    if (!matches || deleting) return
    setDeleting(true)
    setError('')
    try {
      await onConfirm()
      setInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante l\'eliminazione')
      setDeleting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={deleting}>
            Annulla
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={!matches}
            loading={deleting}
          >
            Elimina definitivamente
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{description}</p>

        <div className="bg-red-50 border border-red-200 rounded-[7px] px-3 py-2.5 text-xs text-red-700">
          Questa azione è <strong>irreversibile</strong>. Procedi con cautela.
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Digita <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-900">{confirmLabel ?? confirmName}</span> per confermare
          </label>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
            placeholder={confirmLabel ?? confirmName}
            autoFocus
            className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-red-400 transition-colors"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
