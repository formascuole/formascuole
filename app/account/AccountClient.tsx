'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { generateAvatarColor } from '@/lib/utils'
import { UserRole } from '@/lib/types'

type RegimeFiscale = 'forfettario' | 'ordinario' | 'notula'

interface AccountClientProps {
  nome: string
  email: string
  role: UserRole
  avatarInitials: string
  createdAt: string
  luogo_nascita: string | null
  data_nascita: string | null
  codice_fiscale: string | null
  indirizzo_via: string | null
  indirizzo_cap: string | null
  indirizzo_citta: string | null
  indirizzo_provincia: string | null
  iban: string | null
  banca: string | null
  intestatario_conto: string | null
  tariffa_oraria_formatore: number | null
  tariffa_oraria_tutor: number | null
  ha_partita_iva: boolean
  regime_fiscale: RegimeFiscale
  rivalsa_iva: boolean
  partita_iva?: string | null
  telefono?: string | null
}

const ROLE_BADGES: Record<UserRole, { label: string; cls: string }> = {
  super_admin: { label: 'Super Admin', cls: 'bg-purple-100 text-purple-700' },
  admin:       { label: 'Admin',       cls: 'bg-blue-100 text-blue-700'   },
  formatore:   { label: 'Formatore',   cls: 'bg-green-100 text-green-700' },
  tutor:       { label: 'Tutor',       cls: 'bg-indigo-100 text-indigo-700' },
}

const CF_RE = /^[A-Z]{6}[0-9]{2}[A-EHLMPRST][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i
const IBAN_RE = /^IT[0-9]{2}[A-Z0-9]{23}$/

const REGIME_LABELS: Record<RegimeFiscale, string> = {
  forfettario: 'Regime forfettario',
  ordinario:   'Regime ordinario',
  notula:      'Prestazione occasionale',
}
const REGIME_BADGE_CLS: Record<RegimeFiscale, string> = {
  forfettario: 'bg-green-100 text-green-700',
  ordinario:   'bg-blue-100 text-blue-700',
  notula:      'bg-orange-100 text-orange-700',
}

export function AccountClient({
  nome, email, role, avatarInitials, createdAt,
  luogo_nascita, data_nascita, codice_fiscale,
  indirizzo_via, indirizzo_cap, indirizzo_citta, indirizzo_provincia,
  iban, banca, intestatario_conto,
  tariffa_oraria_formatore, tariffa_oraria_tutor,
  ha_partita_iva, regime_fiscale, rivalsa_iva, partita_iva, telefono,
}: AccountClientProps) {
  // Password change state
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError]   = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)

  // Fiscal edit state
  const [fiscalModalOpen, setFiscalModalOpen] = useState(false)
  const [fiscalSaving, setFiscalSaving] = useState(false)
  const [fiscalError, setFiscalError]   = useState('')
  const [fiscalSuccess, setFiscalSuccess] = useState(false)
  const [fiscal, setFiscal] = useState({
    luogo_nascita:       luogo_nascita ?? '',
    data_nascita:        data_nascita ?? '',
    codice_fiscale:      codice_fiscale ?? '',
    indirizzo_via:       indirizzo_via ?? '',
    indirizzo_cap:       indirizzo_cap ?? '',
    indirizzo_citta:     indirizzo_citta ?? '',
    indirizzo_provincia: indirizzo_provincia ?? '',
    iban:                iban ?? '',
    banca:               banca ?? '',
    intestatario_conto:  intestatario_conto ?? '',
    ha_partita_iva,
    regime_fiscale,
    rivalsa_iva,
    partita_iva: partita_iva ?? '',
    telefono: telefono ?? '',
  })
  // Track saved values to display
  const [savedFiscal, setSavedFiscal] = useState({
    luogo_nascita, data_nascita, codice_fiscale,
    indirizzo_via, indirizzo_cap, indirizzo_citta, indirizzo_provincia,
    iban, banca, intestatario_conto,
    ha_partita_iva, regime_fiscale, rivalsa_iva, partita_iva, telefono,
  })

  const isFiscalRole = role === 'formatore' || role === 'tutor'

  // Password validation
  const newPwdError =
    newPassword.length > 0 && newPassword.length < 8 ? 'Minimo 8 caratteri' : ''
  const confirmError =
    confirmPassword.length > 0 && newPassword !== confirmPassword ? 'Le password non corrispondono' : ''
  const canSavePwd =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword

  // Fiscal validation
  const cfError = fiscal.codice_fiscale && !CF_RE.test(fiscal.codice_fiscale) ? 'Codice fiscale non valido' : ''
  const ibanVal = fiscal.iban.toUpperCase().replace(/\s+/g, '')
  const ibanError = fiscal.iban && !IBAN_RE.test(ibanVal) ? 'IBAN non valido (formato IT + 25 caratteri)' : ''
  const capError = fiscal.indirizzo_cap && !/^\d{5}$/.test(fiscal.indirizzo_cap) ? 'CAP non valido (5 cifre)' : ''
  const provError = fiscal.indirizzo_provincia && !/^[A-Za-z]{2}$/.test(fiscal.indirizzo_provincia) ? 'Sigla provincia non valida (2 lettere)' : ''
  const canSaveFiscal = !cfError && !ibanError && !capError && !provError

  const handleClosePwd = () => {
    setPwdModalOpen(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPwdError('')
    setPwdSuccess(false)
  }

  const handleSavePwd = async () => {
    setPwdError('')
    setPwdSaving(true)
    try {
      const supabase = createClient()
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
      if (signInErr) { setPwdError('Password attuale non corretta.'); return }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updateErr) { setPwdError(updateErr.message); return }
      setPwdSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } finally {
      setPwdSaving(false)
    }
  }

  const handleSaveFiscal = async () => {
    setFiscalError('')
    setFiscalSaving(true)
    try {
      const res = await fetch('/api/onboarding/profilo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fiscal),
      })
      const json = await res.json()
      if (!res.ok) { setFiscalError(json.error || 'Errore durante il salvataggio'); return }
      setSavedFiscal({
        luogo_nascita: json.luogo_nascita,
        data_nascita: json.data_nascita,
        codice_fiscale: json.codice_fiscale,
        indirizzo_via: json.indirizzo_via,
        indirizzo_cap: json.indirizzo_cap,
        indirizzo_citta: json.indirizzo_citta,
        indirizzo_provincia: json.indirizzo_provincia,
        iban: json.iban,
        banca: json.banca,
        intestatario_conto: json.intestatario_conto,
        ha_partita_iva: json.ha_partita_iva ?? false,
        regime_fiscale: (json.regime_fiscale ?? 'notula') as RegimeFiscale,
        rivalsa_iva: json.rivalsa_iva ?? false,
        partita_iva: json.partita_iva ?? null,
        telefono: json.telefono ?? null,
      })
      setFiscalSuccess(true)
      setTimeout(() => { setFiscalModalOpen(false); setFiscalSuccess(false) }, 1200)
    } finally {
      setFiscalSaving(false)
    }
  }

  const bgColor = generateAvatarColor(avatarInitials)
  const badge   = ROLE_BADGES[role] ?? ROLE_BADGES.formatore
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
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0 ${bgColor}`}>
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
            <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">Password</span>
            <Button variant="secondary" size="sm" onClick={() => setPwdModalOpen(true)}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Cambia password
            </Button>
          </div>
        </div>
      </div>

      {/* Dati fiscali e bancari — solo per formatori/tutori */}
      {isFiscalRole && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Dati fiscali e bancari</h2>
            <Button variant="secondary" size="sm" onClick={() => {
              setFiscal({
                luogo_nascita:       savedFiscal.luogo_nascita ?? '',
                data_nascita:        savedFiscal.data_nascita ?? '',
                codice_fiscale:      savedFiscal.codice_fiscale ?? '',
                indirizzo_via:       savedFiscal.indirizzo_via ?? '',
                indirizzo_cap:       savedFiscal.indirizzo_cap ?? '',
                indirizzo_citta:     savedFiscal.indirizzo_citta ?? '',
                indirizzo_provincia: savedFiscal.indirizzo_provincia ?? '',
                iban:                savedFiscal.iban ?? '',
                banca:               savedFiscal.banca ?? '',
                intestatario_conto:  savedFiscal.intestatario_conto ?? '',
                ha_partita_iva:      savedFiscal.ha_partita_iva,
                regime_fiscale:      savedFiscal.regime_fiscale,
                rivalsa_iva:         savedFiscal.rivalsa_iva,
                partita_iva:         savedFiscal.partita_iva ?? '',
                telefono:            savedFiscal.telefono ?? '',
              })
              setFiscalError('')
              setFiscalSuccess(false)
              setFiscalModalOpen(true)
            }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Modifica
            </Button>
          </div>
          <div className="space-y-3">
            <FiscalRow label="Telefono" value={savedFiscal.telefono} />
            <FiscalRow label="Luogo di nascita" value={savedFiscal.luogo_nascita} />
            <FiscalRow label="Data di nascita" value={savedFiscal.data_nascita
              ? new Date(savedFiscal.data_nascita).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
              : null
            } />
            <FiscalRow label="Codice fiscale" value={savedFiscal.codice_fiscale} mono />
            <FiscalRow label="Indirizzo" value={[savedFiscal.indirizzo_via, savedFiscal.indirizzo_cap, savedFiscal.indirizzo_citta, savedFiscal.indirizzo_provincia].filter(Boolean).join(', ') || null} />
            <FiscalRow label="IBAN" value={savedFiscal.iban} mono />
            <FiscalRow label="Banca" value={savedFiscal.banca} />
            <FiscalRow label="Intestatario conto" value={savedFiscal.intestatario_conto} />
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">Regime fiscale</span>
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${REGIME_BADGE_CLS[savedFiscal.regime_fiscale] ?? REGIME_BADGE_CLS.notula}`}>
                {REGIME_LABELS[savedFiscal.regime_fiscale] ?? REGIME_LABELS.notula}
                {savedFiscal.regime_fiscale === 'ordinario' && savedFiscal.rivalsa_iva && ' + IVA 22%'}
              </span>
            </div>
            {savedFiscal.ha_partita_iva && savedFiscal.partita_iva && (
              <FiscalRow label="Partita IVA" value={savedFiscal.partita_iva} mono />
            )}
          </div>
        </div>
      )}

      {/* Le mie tariffe — solo per formatori/tutori */}
      {isFiscalRole && (tariffa_oraria_formatore != null || tariffa_oraria_tutor != null || role === 'formatore' || role === 'tutor') && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-1">Le mie tariffe</h2>
          <p className="text-xs text-gray-400 mb-4">Per modifiche contatta l&apos;amministrazione</p>
          <div className="space-y-4">
            {(role === 'formatore' || tariffa_oraria_formatore != null) && (
              <div>
                <TariffaRow label="Tariffa standard come formatore" value={tariffa_oraria_formatore} />
                <p className="text-xs text-gray-400 mt-1.5">La tariffa può variare per singolo ingaggio — verifica nella scheda del corso specifico</p>
              </div>
            )}
            {(role === 'tutor' || tariffa_oraria_tutor != null) && (
              <div>
                <TariffaRow label="Tariffa standard come tutor" value={tariffa_oraria_tutor} />
                <p className="text-xs text-gray-400 mt-1.5">La tariffa può variare per singolo ingaggio — verifica nella scheda del corso specifico</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password modal */}
      <Modal
        open={pwdModalOpen}
        onClose={handleClosePwd}
        title="Cambia password"
        size="sm"
        footer={
          pwdSuccess ? (
            <Button onClick={handleClosePwd}>Chiudi</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={handleClosePwd}>Annulla</Button>
              <Button onClick={handleSavePwd} loading={pwdSaving} disabled={!canSavePwd}>
                Salva nuova password
              </Button>
            </>
          )
        }
      >
        {pwdSuccess ? (
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-[7px] px-4 py-3">
            <svg className="text-green-500 shrink-0 mt-0.5" width="16" height="16" fill="none" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <p className="text-sm font-medium text-green-800">Password aggiornata!</p>
              <p className="text-xs text-green-700 mt-0.5">Usa la nuova password al prossimo accesso.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Password attuale *"
              type="password"
              placeholder="La tua password attuale"
              value={currentPassword}
              onChange={e => { setCurrentPassword(e.target.value); setPwdError('') }}
              autoComplete="current-password"
            />
            <Input
              label="Nuova password *"
              type="password"
              placeholder="Minimo 8 caratteri"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setPwdError('') }}
              error={newPwdError}
              autoComplete="new-password"
            />
            <Input
              label="Conferma nuova password *"
              type="password"
              placeholder="Ripeti la nuova password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setPwdError('') }}
              error={confirmError}
              autoComplete="new-password"
            />
            {pwdError && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2">
                <svg className="shrink-0 mt-0.5" width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {pwdError}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Fiscal edit modal */}
      <Modal
        open={fiscalModalOpen}
        onClose={() => { setFiscalModalOpen(false); setFiscalError(''); setFiscalSuccess(false) }}
        title="Modifica dati fiscali e bancari"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFiscalModalOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveFiscal} loading={fiscalSaving} disabled={!canSaveFiscal}>
              Salva
            </Button>
          </>
        }
      >
        {fiscalSuccess ? (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-[7px] px-4 py-3">
            <svg className="text-green-500 shrink-0" width="16" height="16" fill="none" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm font-medium text-green-800">Dati salvati!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dati anagrafici</p>
            <Input
              label="Numero di telefono"
              type="tel"
              value={fiscal.telefono}
              onChange={e => setFiscal(f => ({ ...f, telefono: e.target.value }))}
              placeholder="+39 333 1234567"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Luogo di nascita"
                value={fiscal.luogo_nascita}
                onChange={e => setFiscal(f => ({ ...f, luogo_nascita: e.target.value }))}
                placeholder="Es. Roma"
              />
              <Input
                label="Data di nascita"
                type="date"
                value={fiscal.data_nascita}
                onChange={e => setFiscal(f => ({ ...f, data_nascita: e.target.value }))}
              />
            </div>
            <Input
              label="Codice fiscale"
              value={fiscal.codice_fiscale}
              onChange={e => setFiscal(f => ({ ...f, codice_fiscale: e.target.value.toUpperCase() }))}
              placeholder="RSSMRA80A01H501U"
              error={cfError}
              className="font-mono"
            />
            <Input
              label="Indirizzo (via e numero civico)"
              value={fiscal.indirizzo_via}
              onChange={e => setFiscal(f => ({ ...f, indirizzo_via: e.target.value }))}
              placeholder="Via Roma 1"
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="CAP"
                value={fiscal.indirizzo_cap}
                onChange={e => setFiscal(f => ({ ...f, indirizzo_cap: e.target.value }))}
                placeholder="00100"
                error={capError}
              />
              <Input
                label="Città"
                value={fiscal.indirizzo_citta}
                onChange={e => setFiscal(f => ({ ...f, indirizzo_citta: e.target.value }))}
                placeholder="Roma"
              />
              <Input
                label="Prov."
                value={fiscal.indirizzo_provincia}
                onChange={e => setFiscal(f => ({ ...f, indirizzo_provincia: e.target.value.toUpperCase() }))}
                placeholder="RM"
                error={provError}
              />
            </div>

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Dati bancari</p>
            <Input
              label="IBAN"
              value={fiscal.iban}
              onChange={e => setFiscal(f => ({ ...f, iban: e.target.value.toUpperCase() }))}
              placeholder="IT60 X054 2811 1010 0000 0123 456"
              error={ibanError}
              className="font-mono"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Banca"
                value={fiscal.banca}
                onChange={e => setFiscal(f => ({ ...f, banca: e.target.value }))}
                placeholder="Es. Intesa Sanpaolo"
              />
              <Input
                label="Intestatario conto"
                value={fiscal.intestatario_conto}
                onChange={e => setFiscal(f => ({ ...f, intestatario_conto: e.target.value }))}
                placeholder="Mario Rossi"
              />
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Regime fiscale</p>
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Hai una Partita IVA?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFiscal(f => ({
                    ...f,
                    ha_partita_iva: true,
                    regime_fiscale: f.regime_fiscale === 'notula' ? 'forfettario' : f.regime_fiscale,
                  }))}
                  className={`flex-1 py-1.5 rounded-[7px] text-sm font-medium border transition-colors ${fiscal.ha_partita_iva ? 'bg-[#d64b55] text-white border-[#d64b55]' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                >
                  Sì
                </button>
                <button
                  type="button"
                  onClick={() => setFiscal(f => ({ ...f, ha_partita_iva: false, regime_fiscale: 'notula', rivalsa_iva: false }))}
                  className={`flex-1 py-1.5 rounded-[7px] text-sm font-medium border transition-colors ${!fiscal.ha_partita_iva ? 'bg-[#d64b55] text-white border-[#d64b55]' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                >
                  No
                </button>
              </div>
            </div>
            {fiscal.ha_partita_iva && (
              <>
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">Numero Partita IVA</p>
                  <input
                    type="text"
                    value={fiscal.partita_iva ?? ''}
                    onChange={e => setFiscal(f => ({ ...f, partita_iva: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                    placeholder="12345678901"
                    maxLength={11}
                    className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors font-mono"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1.5">Regime</p>
                  <select
                    value={fiscal.regime_fiscale === 'notula' ? 'forfettario' : fiscal.regime_fiscale}
                    onChange={e => setFiscal(f => ({
                      ...f,
                      regime_fiscale: e.target.value as RegimeFiscale,
                      rivalsa_iva: e.target.value !== 'ordinario' ? false : f.rivalsa_iva,
                    }))}
                    className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors bg-white"
                  >
                    <option value="forfettario">Regime forfettario</option>
                    <option value="ordinario">Regime ordinario</option>
                  </select>
                </div>
              </>
            )}
            {fiscal.ha_partita_iva && fiscal.regime_fiscale === 'ordinario' && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fiscal.rivalsa_iva}
                  onChange={e => setFiscal(f => ({ ...f, rivalsa_iva: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 accent-[#d64b55]"
                />
                <span className="text-sm text-gray-700">Applico rivalsa IVA 22%</span>
              </label>
            )}

            {fiscalError && (
              <p className="text-sm text-red-600">{fiscalError}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function FiscalRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>
        {value || <span className="text-gray-300">—</span>}
      </span>
    </div>
  )
}

function TariffaRow({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 font-mono">
        {value != null ? `€ ${Number(value).toFixed(2)}/h` : <span className="text-gray-300 font-sans">Non definita</span>}
      </span>
    </div>
  )
}
