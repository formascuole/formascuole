'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function RifiutaForm({ corsoId }: { corsoId: string }) {
  const router = useRouter()
  const [motivazione, setMotivazione] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRifiuta = async () => {
    if (!motivazione.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/corsi/${corsoId}/rifiuta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivazione: motivazione.trim() }),
      })
      if (res.ok) {
        router.push('/formatore?rifiutato=1')
      } else {
        const j = await res.json()
        setError(j.error || 'Errore durante il rifiuto')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Motivazione <span className="text-red-500">*</span>
        </label>
        <textarea
          value={motivazione}
          onChange={e => setMotivazione(e.target.value)}
          placeholder="Spiega il motivo del rifiuto..."
          rows={4}
          className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors resize-none"
        />
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[7px] px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <Button
        variant="danger"
        onClick={handleRifiuta}
        loading={loading}
        disabled={!motivazione.trim()}
        className="w-full justify-center"
      >
        ✗ Confermo — Rifiuto l&apos;incarico
      </Button>
    </div>
  )
}
