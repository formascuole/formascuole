'use client'
import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface Props {
  open: boolean
  onClose: () => void
  url: string
  titoloCorso: string
  corsoId: string
  hasFormatore: boolean
}

export function QuestionarioModal({ open, onClose, url, titoloCorso, corsoId, hasFormatore }: Props) {
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    if (!open || !url) return
    setQrDataUrl(null)
    setSent(false)
    setSendError('')
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(url, { margin: 2, width: 220 }).then(setQrDataUrl)
    })
  }, [open, url])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleSendEmail = async () => {
    setSending(true)
    setSendError('')
    try {
      const res = await fetch(`/api/corsi/${corsoId}/questionario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, qrDataUrl }),
      })
      const j = await res.json()
      if (!res.ok) { setSendError(j.error || 'Errore durante l\'invio'); return }
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Questionario di valutazione"
      size="sm"
      footer={
        <Button variant="secondary" onClick={onClose}>Chiudi</Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Condividi questo link con i partecipanti al corso{' '}
          <span className="font-semibold text-gray-900">{titoloCorso}</span>
        </p>

        {/* URL + copia */}
        <div className="flex gap-2 items-stretch">
          <input
            readOnly
            value={url}
            onFocus={e => e.target.select()}
            className="flex-1 text-xs border border-gray-200 rounded-[7px] px-3 py-2 bg-gray-50 text-gray-600 select-all font-mono"
          />
          <button
            onClick={handleCopy}
            className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-[7px] transition-all border ${
              copied
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {copied ? '✓ Copiato!' : 'Copia'}
          </button>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-2 py-4 bg-gray-50 rounded-xl border border-gray-100">
          {qrDataUrl ? (
            <>
              <img src={qrDataUrl} alt="QR Code questionario" className="w-44 h-44" />
              <p className="text-xs text-gray-400">Scansiona per aprire il questionario</p>
            </>
          ) : (
            <div className="w-44 h-44 bg-gray-200 rounded animate-pulse" />
          )}
        </div>

        {/* Invia email */}
        {hasFormatore && (
          <div className="border-t border-gray-100 pt-4">
            {sent ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-2.5 rounded-[7px]">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Email inviata al formatore con il link e il QR code.
              </div>
            ) : (
              <>
                <button
                  onClick={handleSendEmail}
                  disabled={sending || !qrDataUrl}
                  className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-[7px] transition-colors disabled:opacity-50"
                >
                  {sending ? (
                    <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2"/>
                      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.5"/>
                      <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                  Invia al formatore via email
                </button>
                {sendError && <p className="text-xs text-red-500 mt-2">{sendError}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Helper: costruisce l'URL del questionario ──────────────────────────────────

export function buildQuestionarioUrl(params: {
  corsoId: string
  scuola: string
  titoloCorso: string
  formatore: string
  tipoCorso: string
  regione?: string
  provincia?: string
  lineaFinanziamento?: string
}): string {
  const today = new Date().toISOString().split('T')[0]
  const base = new URL('https://www.formascuole.it/')
  base.searchParams.set('ff_landing', '13')
  base.searchParams.set('corso_id', params.corsoId || '')
  base.searchParams.set('scuola', params.scuola || '')
  base.searchParams.set('titolo_corso', params.titoloCorso || '')
  base.searchParams.set('formatore', params.formatore || '')
  base.searchParams.set('tipo_corso', params.tipoCorso || '')
  base.searchParams.set('regione', params.regione || '')
  base.searchParams.set('provincia', params.provincia || '')
  base.searchParams.set('linea_finanziamento', params.lineaFinanziamento || '')
  base.searchParams.set('data_somministrazione', today)
  return base.toString()
}
