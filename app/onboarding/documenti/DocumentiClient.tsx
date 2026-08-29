'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface DocumentiClientProps {
  nome: string
  email: string
  cvUrl: string | null
  ciUrl: string | null
  cfUrl: string | null
  cvUploadedAt: string | null
  ciUploadedAt: string | null
  cfUploadedAt: string | null
  redirectTo: string
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function DocumentiClient({ nome, email, cvUrl, ciUrl, cfUrl, cvUploadedAt, ciUploadedAt, cfUploadedAt, redirectTo }: DocumentiClientProps) {
  const router = useRouter()
  const cvRef = useRef<HTMLInputElement>(null)
  const ciRef = useRef<HTMLInputElement>(null)
  const cfRef = useRef<HTMLInputElement>(null)

  const [cvUploaded, setCvUploaded] = useState(!!cvUrl)
  const [ciUploaded, setCiUploaded] = useState(!!ciUrl)
  const [cfUploaded, setCfUploaded] = useState(!!cfUrl)
  const [cvDate, setCvDate] = useState(cvUploadedAt)
  const [ciDate, setCiDate] = useState(ciUploadedAt)
  const [cfDate, setCfDate] = useState(cfUploadedAt)

  const [cvLoading, setCvLoading] = useState(false)
  const [ciLoading, setCiLoading] = useState(false)
  const [cfLoading, setCfLoading] = useState(false)
  const [cvError, setCvError] = useState('')
  const [ciError, setCiError] = useState('')
  const [cfError, setCfError] = useState('')
  const [completing, setCompleting] = useState(false)

  const canComplete = cvUploaded && ciUploaded && cfUploaded

  const handleUpload = async (tipo: 'cv' | 'ci' | 'cf', file: File) => {
    const setLoading = tipo === 'cv' ? setCvLoading : tipo === 'ci' ? setCiLoading : setCfLoading
    const setError  = tipo === 'cv' ? setCvError  : tipo === 'ci' ? setCiError  : setCfError
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('tipo', tipo)
      fd.append('file', file)
      const res = await fetch('/api/profilo/upload-documento', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Errore upload'); return }
      const now = new Date().toISOString()
      if (tipo === 'cv') { setCvUploaded(true); setCvDate(now) }
      else if (tipo === 'ci') { setCiUploaded(true); setCiDate(now) }
      else { setCfUploaded(true); setCfDate(now) }
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = () => {
    setCompleting(true)
    router.push(redirectTo)
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-start py-12 px-4">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#d64b55' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-xl font-bold text-gray-900">Formascuole</span>
      </div>

      {/* Progress */}
      <div className="w-full max-w-md mb-6">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-[#d64b55]" />
          <div className="flex-1 h-1.5 rounded-full bg-[#d64b55]" />
          <div className="flex-1 h-1.5 rounded-full bg-[#d64b55]" />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs font-medium text-gray-400">1 · Password</span>
          <span className="text-xs font-medium text-gray-400">2 · Profilo</span>
          <span className="text-xs font-medium text-[#d64b55]">3 · Documenti</span>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8" style={{ border: '0.5px solid #e5e5e5' }}>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Carica i tuoi documenti</h1>
        <p className="text-sm text-gray-500 mb-6">
          Per completare la registrazione devi caricare CV, documento d&apos;identità e tessera del codice fiscale.
        </p>

        <div className="space-y-4">
          {/* CV */}
          <UploadCard
            label="Curriculum Vitae (CV)"
            hint="PDF, DOC, DOCX o ODT — max 5 MB"
            uploaded={cvUploaded}
            uploadedAt={cvDate}
            loading={cvLoading}
            error={cvError}
            inputRef={cvRef}
            accept=".pdf,.doc,.docx,.odt"
            onChange={f => handleUpload('cv', f)}
          />

          {/* CI */}
          <UploadCard
            label="Carta d'identità o Passaporto (fronte e retro)"
            hint="PDF, JPG o PNG — max 5 MB"
            uploaded={ciUploaded}
            uploadedAt={ciDate}
            loading={ciLoading}
            error={ciError}
            inputRef={ciRef}
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={f => handleUpload('ci', f)}
          />

          {/* CF */}
          <UploadCard
            label="Codice Fiscale (fronte e retro in un unico file)"
            hint="Scansiona o fotografa entrambi i lati — PDF, JPG o PNG — max 5 MB"
            uploaded={cfUploaded}
            uploadedAt={cfDate}
            loading={cfLoading}
            error={cfError}
            inputRef={cfRef}
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={f => handleUpload('cf', f)}
          />
        </div>

        <button
          onClick={handleComplete}
          disabled={!canComplete || completing}
          className="mt-6 w-full py-2.5 rounded-[7px] text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#d64b55' }}
        >
          {completing ? 'Accesso…' : 'Completa registrazione →'}
        </button>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Accesso per <span className="font-medium">{email}</span>
      </p>
    </div>
  )
}

interface UploadCardProps {
  label: string
  hint: string
  uploaded: boolean
  uploadedAt: string | null
  loading: boolean
  error: string
  inputRef: React.RefObject<HTMLInputElement | null>
  accept: string
  onChange: (file: File) => void
}

function UploadCard({ label, hint, uploaded, uploadedAt, loading, error, inputRef, accept, onChange }: UploadCardProps) {
  return (
    <div className={`border rounded-[7px] p-4 transition-colors ${uploaded ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            {uploaded ? (
              <svg className="text-green-500 shrink-0" width="16" height="16" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <polyline points="8 12 11 15 16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg className="text-gray-400 shrink-0" width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            <span className="text-sm font-medium text-gray-900">{label}</span>
          </div>
          {uploaded && uploadedAt ? (
            <p className="text-xs text-green-700 ml-6">Caricato il {formatDate(uploadedAt)}</p>
          ) : (
            <p className="text-xs text-gray-400 ml-6">{hint}</p>
          )}
          {error && <p className="text-xs text-red-600 ml-6 mt-1">{error}</p>}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="shrink-0 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-[7px] bg-white text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-50"
        >
          {loading ? '…' : uploaded ? 'Aggiorna' : 'Carica'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f) }}
      />
    </div>
  )
}
