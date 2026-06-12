import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { CalendarioFormatoreClient } from './CalendarioFormatoreClient'

export default async function CalendarioFormatorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (profile.role !== 'formatore') redirect('/dashboard')

  const admin = createAdminClient()

  // Corsi assegnati al formatore
  const { data: corsi } = await admin
    .from('corsi')
    .select('id, title, project_id')
    .eq('formatore_id', user.id)

  const corsoIds = (corsi || []).map(c => c.id)

  // Session data
  type RawSessione = {
    id: string; data: string; ore: number; completata: boolean; corso_id: string
    corso: { id: string; title: string; project_id: string; progetti: { school_name: string } | null } | null
  }

  let sessioni: {
    id: string; data: string; ore: number; completata: boolean
    corso_id: string; corso_title: string; school_name: string; project_id: string
  }[] = []

  if (corsoIds.length > 0) {
    const { data: rawSessioni } = await admin
      .from('sessioni')
      .select('id, data, ore, completata, corso_id, corso:corsi(id, title, project_id, progetti(school_name))')
      .in('corso_id', corsoIds)
      .order('data')

    sessioni = ((rawSessioni as unknown as RawSessione[]) || []).map(s => ({
      id: s.id,
      data: s.data,
      ore: Number(s.ore),
      completata: s.completata,
      corso_id: s.corso_id,
      corso_title: s.corso?.title || '—',
      school_name: s.corso?.progetti?.school_name || '—',
      project_id: s.corso?.project_id || '',
    }))
  }

  // Indisponibilità del formatore
  type RawInd = { id: string; formatore_id: string; data: string; fascia: string; note: string | null }
  const { data: rawInd } = await admin
    .from('indisponibilita_formatori')
    .select('id, formatore_id, data, fascia, note')
    .eq('formatore_id', user.id)
    .order('data')

  const indisponibilita = (rawInd as RawInd[] || []).map(i => ({
    id: i.id,
    formatore_id: i.formatore_id,
    formatore_nome: profile.nome,
    data: i.data,
    fascia: i.fascia as 'mattina' | 'pomeriggio' | 'tutto_il_giorno',
    note: i.note,
  }))

  return (
    <AppLayout
      role="formatore"
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      regimeFiscale={profile.regime_fiscale}
    >
      <CalendarioFormatoreClient
        initialSessioni={sessioni}
        initialIndisponibilita={indisponibilita}
        currentUserId={user.id}
        formatoreNome={profile.nome}
      />
    </AppLayout>
  )
}
