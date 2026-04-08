import { createClient } from '@supabase/supabase-js'

// Service role client — only for server-side use (API routes, cron)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * Checks if a user is super_admin using the service role client (bypasses RLS).
 * Checks both profiles.role and profiles_roles table to handle the multi-role system.
 */
export async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', userId).single(),
    admin.from('profiles_roles').select('role').eq('profile_id', userId).eq('role', 'super_admin').maybeSingle(),
  ])
  return profile?.role === 'super_admin' || !!roleRow
}
