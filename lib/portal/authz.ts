import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import type { CustomerAccount, CustomerMembership, Project, User } from '@prisma/client'
import { canAccessProject } from '@/lib/portal/access-rules'

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
