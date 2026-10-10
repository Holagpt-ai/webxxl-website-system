import type { UserRole } from '@prisma/client'
import { isStaffRole } from '@/lib/admin/roles'

/** Whether an authenticated user role may access /admin routes. */
export function canAccessAdminWorkspace(role: UserRole): boolean {
  return isStaffRole(role)
}
