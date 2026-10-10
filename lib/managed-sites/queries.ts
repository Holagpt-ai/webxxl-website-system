import { prisma } from '@/lib/db'

const siteListInclude = {
  customerAccount: { select: { id: true, businessName: true, slug: true } },
  project: { select: { id: true, name: true } },
  capabilities: true,
} as const

export async function listManagedSitesForAccount(customerAccountId: string) {
  return prisma.managedSite.findMany({
    where: { customerAccountId },
    orderBy: { name: 'asc' },
    include: { capabilities: true, project: { select: { id: true, name: true } } },
  })
}

export async function getManagedSiteForAccount(siteId: string, customerAccountId: string) {
  return prisma.managedSite.findFirst({
    where: { id: siteId, customerAccountId },
    include: {
      capabilities: true,
      project: { select: { id: true, name: true } },
      changes: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })
}

export async function listManagedSitesForStaff(search?: string) {
  const q = search?.trim()
  return prisma.managedSite.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { domain: { contains: q, mode: 'insensitive' } },
            { customerAccount: { businessName: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: 'desc' },
    include: siteListInclude,
  })
}

export async function getManagedSiteForStaff(siteId: string) {
  return prisma.managedSite.findUnique({
    where: { id: siteId },
    include: {
      ...siteListInclude,
      changes: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { requestedBy: { select: { email: true, name: true } } },
      },
      changeRequests: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, status: true, projectId: true },
      },
    },
  })
}

export async function listSiteFormOptions() {
  const [customers, projects] = await Promise.all([
    prisma.customerAccount.findMany({
      orderBy: { businessName: 'asc' },
      select: { id: true, businessName: true },
    }),
    prisma.project.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, customerAccountId: true },
    }),
  ])
  return { customers, projects }
}
