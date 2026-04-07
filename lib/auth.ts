import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from './types'

/**
 * Returns all roles assigned to the current authenticated user.
 * Falls back to reading profiles.role if profiles_roles is empty (pre-migration).
 */
export async function getUserRoles(supabase: SupabaseClient): Promise<UserRole[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: rows } = await supabase
    .from('profiles_roles')
    .select('role')
    .eq('profile_id', user.id)

  if (rows && rows.length > 0) {
    return rows.map((r: { role: UserRole }) => r.role)
  }

  // Fallback: read from profiles.role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile ? [profile.role as UserRole] : []
}

/** Returns true if the user has admin-level access (admin or super_admin). */
export function isAdminRole(roles: UserRole[]): boolean {
  return roles.includes('admin') || roles.includes('super_admin')
}

export function isSuperAdmin(roles: UserRole[]): boolean {
  return roles.includes('super_admin')
}

export function isFormatore(roles: UserRole[]): boolean {
  return roles.includes('formatore')
}

export function isTutor(roles: UserRole[]): boolean {
  return roles.includes('tutor')
}

/**
 * Returns the "primary" (highest) role for routing decisions.
 * Order: super_admin > admin > formatore > tutor
 */
export function primaryRole(roles: UserRole[]): UserRole | null {
  if (roles.includes('super_admin')) return 'super_admin'
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('formatore')) return 'formatore'
  if (roles.includes('tutor')) return 'tutor'
  return null
}

/** Label and badge color for a role */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  formatore: 'Formatore',
  tutor: 'Tutor',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-red-100 text-red-700',
  admin: 'bg-blue-100 text-blue-700',
  formatore: 'bg-purple-100 text-purple-700',
  tutor: 'bg-teal-100 text-teal-700',
}
