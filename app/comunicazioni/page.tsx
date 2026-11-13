import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ComunicazioniClient } from './ComunicazioniClient'

export default async function ComunicazioniPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) redirect('/dashboard')

  const admin = createAdminClient()

  // Progetti per il selettore
  const { data: progetti } = await admin
    .from('progetti')
    .select('id, school_name, linea_finanziamento')
    .order('school_name', { ascending: true })

  // Log ultimi 50 invii
  const { data: logs } = await admin
    .from('comunicazioni_log')
    .select('id, created_at, tipologia, oggetto, n_inviati, n_errori, progetto_id, inviata_da, progetti(school_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <ComunicazioniClient
      progetti={progetti ?? []}
      logs={logs ?? []}
    />
  )
}
