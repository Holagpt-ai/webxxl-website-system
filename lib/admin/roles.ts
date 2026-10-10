import type { UserRole } from '@prisma/client'

export function isStaffRole(role: UserRole): boolean {
  return role === 'STAFF' || role === 'ADMIN'
}

export function isAdminRole(role: UserRole): boolean {
  return role === 'ADMIN'
}
