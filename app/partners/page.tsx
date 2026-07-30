import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkIsSuperAdmin, createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { calcCommissionePartner } from '@/lib/economia-utils'
import { PartnersClient } from './PartnersClient'

export interface PartnerProgettoDato {
  id: string
  school_name: string
  status: 'active' | 'pending' | 'completed'
  finanziamento_nome: string | null
  is_subappalto: boolean
  fatturato_scuola: number
  commissione_totale_ivato: number
  commissione_imponibile: number
  commissione_iva: number
  // subappalto billing (partner pays SVC)
  imponibile_partner: number
  iva_partner: number
  totale_partner: number
}

export default async function PartnersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/dashboard')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)
  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  const admin = createAdminClient()

  // Fetch all partners + all projects that have a partner
  const [{ data: partnersRaw }, { data: progettiRaw }] = await Promise.all([
    admin.from('partners').select('*').order('nome'),
    admin.from('progetti')
      .select('id, school_name, status, finanziamento_id, partner_id, quota_progettazione, is_subappalto, subappalto_tariffa_formatore, subappalto_tariffa_tutor')
      .not('partner_id', 'is', null),
  ])

  const progettiConPartner = progettiRaw ?? []
  const progettiIds = progettiConPartner.map(p => p.id as string)

  // Fetch finanziamenti for those projects
  const finIds = [...new Set(
    progettiConPartner
      .map(p => p.finanziamento_id as string | null)
      .filter((f): f is string => f !== null)
  )]
  const { data: finanziamentiRaw } = await admin
    .from('finanziamenti')
    .select('id, nome, tariffa_formatore_ora, tariffa_tutor_ora')
    .in('id', finIds.length > 0 ? finIds : ['none'])

  // Fetch completed corsi for those projects
  const { data: corsiRaw } = await admin
    .from('corsi')
    .select('id, project_id, tipo, tutor_id, ore_tutoraggio, tariffa_oraria, tariffa_oraria_tutor')
    .in('project_id', progettiIds.length > 0 ? progettiIds : ['none'])
    .eq('corso_completato', true)

  // Fetch completed sessioni for those corsi
  const corsiIds = (corsiRaw ?? []).map(c => c.id as string)
  const { data: sessioniRaw } = await admin
    .from('sessioni')
    .select('corso_id, ore')
    .in('corso_id', corsiIds.length > 0 ? corsiIds : ['none'])
    .eq('completata', true)

  // Build lookup maps
  const finanziamentiMap = new Map((finanziamentiRaw ?? []).map(f => [f.id as string, f]))
  const progettiMap = new Map(progettiConPartner.map(p => [p.id as string, p]))

  // Sum ore erogate per corso
  const orePerCorso = new Map<string, number>()
  for (const s of sessioniRaw ?? []) {
    const cid = s.corso_id as string
    orePerCorso.set(cid, (orePerCorso.get(cid) ?? 0) + Number(s.ore))
  }

  // Compute fatturato from corsi per project
  const fatturatoCorsiPerProgetto = new Map<string, number>()
  const fatturatoPartnerImponibilePerProgetto = new Map<string, number>()
  for (const c of corsiRaw ?? []) {
    const progetto = progettiMap.get(c.project_id as string)
    if (!progetto) continue
    const finId = progetto.finanziamento_id as string | null
    const fin = finId ? finanziamentiMap.get(finId) : null
    const tariffaF = (fin?.tariffa_formatore_ora as number | null) ?? null
    const tariffaT = (fin?.tariffa_tutor_ora as number | null) ?? null
    const oreErogate = orePerCorso.get(c.id as string) ?? 0
    const hasTutor = !!c.tutor_id && c.tipo === 'PF'
    const oreTutor = hasTutor ? Number(c.ore_tutoraggio ?? 0) : 0
    const importoF = tariffaF != null && oreErogate > 0 ? oreErogate * tariffaF : 0
    const importoT = tariffaT != null && oreTutor > 0 ? oreTutor * tariffaT : 0
    const pid = c.project_id as string
    fatturatoCorsiPerProgetto.set(pid, (fatturatoCorsiPerProgetto.get(pid) ?? 0) + importoF + importoT)

    const isSubappalto = !!(progetto.is_subappalto as boolean | null)
    if (isSubappalto) {
      const tariffaSubF = Number((progetto.subappalto_tariffa_formatore as number | null) ?? 0)
      const tariffaSubT = Number((progetto.subappalto_tariffa_tutor as number | null) ?? 0)
      const impSubF = tariffaSubF > 0 && oreErogate > 0 ? oreErogate * tariffaSubF : 0
      const impSubT = tariffaSubT > 0 && oreTutor > 0 ? oreTutor * tariffaSubT : 0
      fatturatoPartnerImponibilePerProgetto.set(pid, (fatturatoPartnerImponibilePerProgetto.get(pid) ?? 0) + impSubF + impSubT)
    }
  }

  // Build per-partner project list with economics
  const partnerProgetti: Record<string, PartnerProgettoDato[]> = {}
  for (const p of progettiConPartner) {
    const partnerId = p.partner_id as string
    const fatturatoCorsі = fatturatoCorsiPerProgetto.get(p.id as string) ?? 0
    const quota = Number((p.quota_progettazione as number | null) ?? 0)
    const fatturato_scuola = fatturatoCorsі + quota
    const isSubappalto = !!(p.is_subappalto as boolean | null)
    const comm = isSubappalto ? { totale_ivato: 0, imponibile: 0, iva: 0 } : calcCommissionePartner(fatturato_scuola)
    const imponibile_partner = isSubappalto ? (fatturatoPartnerImponibilePerProgetto.get(p.id as string) ?? 0) : 0
    const iva_partner = imponibile_partner * 0.22
    const totale_partner = imponibile_partner + iva_partner
    const finId = p.finanziamento_id as string | null
    const finanziamento_nome = finId ? ((finanziamentiMap.get(finId)?.nome as string | null) ?? null) : null
    if (!partnerProgetti[partnerId]) partnerProgetti[partnerId] = []
    partnerProgetti[partnerId].push({
      id: p.id as string,
      school_name: p.school_name as string,
      status: p.status as 'active' | 'pending' | 'completed',
      finanziamento_nome,
      is_subappalto: isSubappalto,
      fatturato_scuola,
      commissione_totale_ivato: comm.totale_ivato,
      commissione_imponibile: comm.imponibile,
      commissione_iva: comm.iva,
      imponibile_partner,
      iva_partner,
      totale_partner,
    })
  }

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
    >
      <PartnersClient
        partners={partnersRaw ?? []}
        partnerProgetti={partnerProgetti}
      />
    </AppLayout>
  )
}
