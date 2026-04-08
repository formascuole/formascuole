import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { FormatoreClient } from './FormatoreClient'
import { NoProfileError } from './NoProfileError'

export default async function FormatorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  if (profile && profile.role === 'tutor') redirect('/tutor')
  if (profile && !['formatore', 'tutor'].includes(profile.role)) redirect('/dashboard')

  if (!profile) {
    return <NoProfileError />
  }

  // Usa il service role client per bypassare RLS — il client normale non mostra
  // i corsi al formatore a causa delle policy RLS sulla view corsi_con_ore
  const admin = createAdminClient()

  // TEST HARDCODED: query diretta su corsi con ID noto
  const HARDCODED_ID = '6b48d2df-339b-4625-91bc-1610f7fd9ea9'
  const { data: testCorsi, error: testError } = await admin
    .from('corsi')
    .select('id, title, formatore_id')
    .eq('formatore_id', HARDCODED_ID)
  console.log('[DEBUG] user.id dalla sessione:', user.id)
  console.log('[DEBUG] testCorsi (hardcoded id):', JSON.stringify(testCorsi))
  console.log('[DEBUG] testError:', JSON.stringify(testError))

  const { data: corsi, error: corsiError } = await admin
    .from('corsi_con_ore')
    .select('*, progetti(id,school_name,address,anno_scolastico,ref_name,ref_email,ref_tel,finanziamento_id)')
    .eq('formatore_id', user.id)
    .order('created_at')
  console.log('[DEBUG] corsi (user.id):', JSON.stringify(corsi?.map(c => c.id)))
  console.log('[DEBUG] corsiError:', JSON.stringify(corsiError))

  // Batch-fetch referenti specifici dei corsi
  const referenteIds = [...new Set(
    (corsi || []).filter(c => c.referente_id).map(c => c.referente_id as string)
  )]
  const referentiMap = new Map<string, { id: string; nome: string; email: string; tel?: string }>()
  if (referenteIds.length > 0) {
    const { data: referenti } = await admin
      .from('referenti_progetto')
      .select('id,nome,email,tel')
      .in('id', referenteIds)
    for (const r of referenti || []) referentiMap.set(r.id, r)
  }

  const corsiConReferente = (corsi || []).map(c => ({
    ...c,
    referente: c.referente_id ? referentiMap.get(c.referente_id) || null : null,
  }))

  const { data: finanziamenti } = await supabase
    .from('finanziamenti')
    .select('id,nome')
    .order('nome')

  const debugInfo = {
    sessionUserId: user.id,
    hardcodedId: HARDCODED_ID,
    idsMatch: user.id === HARDCODED_ID,
    testCorsiCount: testCorsi?.length ?? null,
    testCorsiIds: testCorsi?.map(c => c.id) ?? [],
    testError: testError?.message ?? null,
    corsiByUserId: corsi?.length ?? null,
    corsiError: (corsiError as { message?: string } | null)?.message ?? null,
  }

  return (
    <AppLayout role="formatore" nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials}>
      <div className="px-8 pt-6 max-w-4xl mx-auto">
        <div className="mb-4 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 text-xs font-mono text-yellow-900 space-y-1">
          <div><strong>DEBUG</strong></div>
          <div>session user.id: <strong>{debugInfo.sessionUserId}</strong></div>
          <div>hardcoded id: <strong>{debugInfo.hardcodedId}</strong></div>
          <div>IDs match: <strong>{String(debugInfo.idsMatch)}</strong></div>
          <div>corsi con hardcoded id: <strong>{String(debugInfo.testCorsiCount)}</strong> — {JSON.stringify(debugInfo.testCorsiIds)}</div>
          <div>corsi con user.id: <strong>{String(debugInfo.corsiByUserId)}</strong></div>
          {debugInfo.testError && <div>testError: {debugInfo.testError}</div>}
          {debugInfo.corsiError && <div>corsiError: {debugInfo.corsiError}</div>}
        </div>
      </div>
      <FormatoreClient corsi={corsiConReferente} profile={profile} finanziamenti={finanziamenti || []} />
    </AppLayout>
  )
}
