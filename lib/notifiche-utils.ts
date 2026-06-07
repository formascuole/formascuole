import type { SupabaseClient } from '@supabase/supabase-js'

export async function getUnreadNotificheCount(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: lette } = await supabase
    .from('notifiche_lette')
    .select('notifica_id')
    .eq('user_id', userId)

  const letteIds = (lette || []).map(r => r.notifica_id as string)

  if (letteIds.length === 0) {
    const { count } = await supabase
      .from('solleciti_log')
      .select('*', { count: 'exact', head: true })
    return count ?? 0
  }

  const { count } = await supabase
    .from('solleciti_log')
    .select('*', { count: 'exact', head: true })
    .not('id', 'in', `(${letteIds.join(',')})`)
  return count ?? 0
}

export async function getLetteIds(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('notifiche_lette')
    .select('notifica_id')
    .eq('user_id', userId)
  return new Set((data || []).map(r => r.notifica_id as string))
}
