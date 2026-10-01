'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function AccettaForm({ corsoId, isCoFormatore = false }: { corsoId: string; isCoFormatore?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAccetta = async () => {
    setLoading(true)
    setError('')
    try {
      const url = isCoFormatore
        ? `/api/corsi/${corsoId}/accetta?ruolo=co_formatore`
        : `/api/corsi/${corsoId}/accetta`
      const res = await fetch(url, { method: 'POST' })
      if (res.ok) {
        router.push('/formatore?accettato=1')
      } else {
        const j = await res.json()
        setError(j.error || 'Errore durante l\'accettazione')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-[7px] px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <Button onClick={handleAccetta} loading={loading} className="w-full justify-center">
        ✓ Confermo — Accetto l&apos;incarico
      </Button>
    </div>
  )
}
