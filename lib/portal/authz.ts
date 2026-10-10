import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import type { CustomerAccount, CustomerMembership, Project, User } from '@prisma/client'
import { customerOwnsManagedSite } from '@/lib/managed-sites/domain'
import { routeManagedSiteRequest } from '@/lib/managed-sites/routing'
import { canCustomerAccessProjectFile } from '@/lib/files/access'
import { canAccessProject } from '@/lib/portal/access-rules'
import { isAdminRole, isStaffRole } from '@/lib/admin/roles'

export class AuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'AuthError'
  }
}

export type PortalUser = User & { membership: CustomerMembership; customerAccount: CustomerAccount }

export async function requireUser(): Promise<User> {
  const session = await auth()
  if (!session?.user?.id) throw new AuthError()
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) throw new AuthError()
  return user
}

export async function requireStaff(): Promise<User> {
  const user = await requireUser()
  if (!isStaffRole(user.role)) throw new AuthError('Staff access required')
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser()
  if (!isAdminRole(user.role)) throw new AuthError('Admin access required')
  return user
}

export async function requireCustomerMembership(): Promise<PortalUser> {
  const user = await requireUser()
  const membership = await prisma.customerMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    include: { customerAccount: true },
  })
  if (!membership) throw new AuthError('No customer account')
  return { ...user, membership, customerAccount: membership.customerAccount }
}

export async function requireProjectAccess(projectId: string): Promise<{ portal: PortalUser; project: Project }> {
  const portal = await requireCustomerMembership()
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project || !canAccessProject(portal.customerAccount.id, project.customerAccountId)) {
    throw new AuthError('Project access denied')
  }
  return { portal, project }
}

export async function requireProjectFileAccess(fileId: string) {
  const portal = await requireCustomerMembership()
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: { project: true },
  })
  if (!file || !canCustomerAccessProjectFile(portal.customerAccount.id, file.project.customerAccountId)) {
    throw new AuthError('File access denied')
  }
  return { portal, file }
}

export async function requireStaffProjectFileAccess(fileId: string) {
  const staff = await requireStaff()
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: { project: true },
  })
  if (!file) throw new AuthError('File not found')
  return { staff, file }
}

/** Customer members of the file's account, or any staff/admin user. */
export async function authorizeProjectFileRead(fileId: string) {
  const user = await requireUser()
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: { project: true },
  })
  if (!file) throw new AuthError('File not found')
  if (isStaffRole(user.role)) return { user, file }
  const membership = await prisma.customerMembership.findFirst({
    where: { userId: user.id, customerAccountId: file.project.customerAccountId },
  })
  if (!membership || !canCustomerAccessProjectFile(membership.customerAccountId, file.project.customerAccountId)) {
    throw new AuthError('File access denied')
  }
  return { user, file }
}

export async function requireManagedSiteCustomerAccess(siteId: string) {
  const portal = await requireCustomerMembership()
  const site = await prisma.managedSite.findUnique({
    where: { id: siteId },
    include: { capabilities: true },
  })
  if (!site || !customerOwnsManagedSite(portal.customerAccount.id, site.customerAccountId)) {
    throw new AuthError('Site access denied')
  }
  return { portal, site }
}

export async function requireManagedSiteStaffAccess(siteId: string) {
  const staff = await requireStaff()
  const site = await prisma.managedSite.findUnique({
    where: { id: siteId },
    include: { capabilities: true },
  })
  if (!site) throw new AuthError('Site not found')
  return { staff, site }
}

export async function requireCapabilityAccess(siteId: string, capabilityKey: string) {
  const access = await requireManagedSiteCustomerAccess(siteId)
  const assignment = access.site.capabilities.find((item) => item.capabilityKey === capabilityKey) ?? null
  const decision = routeManagedSiteRequest({
    capabilityKey,
    assignment,
    actor: 'customer',
  })
  if (decision.mode === 'UNAVAILABLE' || !decision.capability) {
    throw new AuthError(decision.reason)
  }
  return { ...access, capability: decision.capability }
}

/** Resolve active project for the customer account (first active, else most recent). */
export async function getActiveProject(customerAccountId: string): Promise<Project | null> {
  return (
    (await prisma.project.findFirst({
      where: { customerAccountId, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    })) ??
    (await prisma.project.findFirst({
      where: { customerAccountId },
      orderBy: { updatedAt: 'desc' },
    }))
  )
}
