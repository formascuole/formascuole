import type { SupabaseClient } from '@supabase/supabase-js'

export async function getLettereCount(admin: SupabaseClient, userId: string, role: 'formatore' | 'tutor'): Promise<number> {
  if (role === 'formatore') {
    const { count } = await admin
      .from('corsi')
      .select('*', { count: 'exact', head: true })
      .eq('formatore_id', userId)
      .not('lettera_incarico_url', 'is', null)
      .not('lettera_incarico_inviata_at', 'is', null)
      .eq('lettera_incarico_firmata', false)
    return count || 0
  } else {
    const { count } = await admin
      .from('corsi')
      .select('*', { count: 'exact', head: true })
      .eq('tutor_id', userId)
      .not('lettera_tutor_url', 'is', null)
      .not('lettera_tutor_inviata_at', 'is', null)
      .eq('lettera_tutor_firmata', false)
    return count || 0
  }
}
