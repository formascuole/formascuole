import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getLettereCount } from '@/lib/get-lettere-count'
import { LettereIncaricoClient } from './LettereIncaricoClient'

export default async function LettereIncaricoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (!['formatore', 'tutor'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch formatore letters (for both formatore and tutor roles — user might have both)
  const { data: corsiFormatore } = profile.role === 'formatore' ? await admin
    .from('corsi')
    .select('id, title, tipo, ore_totali, project_id, lettera_incarico_url, lettera_incarico_firmata, lettera_incarico_firmata_at, lettera_incarico_inviata_at')
    .eq('formatore_id', user.id)
    .not('lettera_incarico_url', 'is', null)
    .order('created_at') : { data: [] }

  // Fetch tutor letters
  const { data: corsiTutor } = await admin
    .from('corsi')
    .select('id, title, ore_tutoraggio, project_id, lettera_tutor_url, lettera_tutor_firmata, lettera_tutor_firmata_at, lettera_tutor_inviata_at')
    .eq('tutor_id', user.id)
    .not('lettera_tutor_url', 'is', null)
    .order('created_at')

  // Collect all project IDs
  const allProjectIds = [...new Set([
    ...(corsiFormatore || []).map(c => c.project_id as string),
    ...(corsiTutor || []).map(c => c.project_id as string),
  ])]

  // Fetch project names
  const progettiMap = new Map<string, { id: string; school_name: string }>()
  if (allProjectIds.length > 0) {
    const { data: progetti } = await admin
      .from('progetti')
      .select('id, school_name')
      .in('id', allProjectIds)
    for (const p of progetti || []) progettiMap.set(p.id, p)
  }

  // Build grouped structure
  type LetteraFormatore = {
    id: string; title: string; tipo: string; ore_totali: number
    lettera_incarico_url: string
    lettera_incarico_firmata: boolean
    lettera_incarico_firmata_at: string | null
    lettera_incarico_inviata_at: string | null
  }
  type LetteraTutor = {
    id: string; title: string; ore_tutoraggio: number
    lettera_tutor_url: string
    lettera_tutor_firmata: boolean
    lettera_tutor_firmata_at: string | null
    lettera_tutor_inviata_at: string | null
  }
  type ProgettoLettere = {
    id: string; school_name: string
    lettere_formatore: LetteraFormatore[]
    lettere_tutor: LetteraTutor[]
  }

  const progettiLettere = new Map<string, ProgettoLettere>()

  for (const c of corsiFormatore || []) {
    const pid = c.project_id as string
    if (!progettiLettere.has(pid)) {
      progettiLettere.set(pid, {
        id: pid,
        school_name: progettiMap.get(pid)?.school_name ?? pid,
        lettere_formatore: [],
        lettere_tutor: [],
      })
    }
    progettiLettere.get(pid)!.lettere_formatore.push({
      id: c.id as string,
      title: c.title as string,
      tipo: c.tipo as string,
      ore_totali: Number(c.ore_totali),
      lettera_incarico_url: c.lettera_incarico_url as string,
      lettera_incarico_firmata: Boolean(c.lettera_incarico_firmata),
      lettera_incarico_firmata_at: c.lettera_incarico_firmata_at as string | null,
      lettera_incarico_inviata_at: c.lettera_incarico_inviata_at as string | null,
    })
  }

  for (const c of corsiTutor || []) {
    const pid = c.project_id as string
    if (!progettiLettere.has(pid)) {
      progettiLettere.set(pid, {
        id: pid,
        school_name: progettiMap.get(pid)?.school_name ?? pid,
        lettere_formatore: [],
        lettere_tutor: [],
      })
    }
    progettiLettere.get(pid)!.lettere_tutor.push({
      id: c.id as string,
      title: c.title as string,
      ore_tutoraggio: Number(c.ore_tutoraggio || 0),
      lettera_tutor_url: c.lettera_tutor_url as string,
      lettera_tutor_firmata: Boolean(c.lettera_tutor_firmata),
      lettera_tutor_firmata_at: c.lettera_tutor_firmata_at as string | null,
      lettera_tutor_inviata_at: c.lettera_tutor_inviata_at as string | null,
    })
  }

  const progetti = Array.from(progettiLettere.values())

  const lettereCount = await getLettereCount(admin, user.id, profile.role as 'formatore' | 'tutor')

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      regimeFiscale={profile.regime_fiscale}
      lettereCount={lettereCount}
    >
      <LettereIncaricoClient
        progetti={progetti}
        role={profile.role as 'formatore' | 'tutor'}
      />
    </AppLayout>
  )
}
