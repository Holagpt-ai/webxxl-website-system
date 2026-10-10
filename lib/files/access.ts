import type { UserRole } from '@prisma/client'

export function canCustomerAccessProjectFile(customerAccountId: string, fileCustomerAccountId: string): boolean {
  return customerAccountId === fileCustomerAccountId
}

export function canDeleteProjectFile(role: UserRole): boolean {
  return role === 'STAFF' || role === 'ADMIN'
}

/** Files may only be linked to a workflow on the same project. */
export function canAttachFileToProject(fileProjectId: string, targetProjectId: string | null | undefined): boolean {
  if (!targetProjectId) return false
  return fileProjectId === targetProjectId
}

export function customerCommentVisibility(): 'CUSTOMER' {
  return 'CUSTOMER'
}

export function parseStaffCommentVisibility(value: unknown): 'CUSTOMER' | 'INTERNAL' | null {
  if (value === 'CUSTOMER' || value === 'INTERNAL') return value
  return null
}
