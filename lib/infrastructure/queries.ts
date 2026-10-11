import { prisma } from '@/lib/db'

const hostingCustomerSelect = {
  id: true,
  publicId: true,
  providerId: true,
  externalProviderRef: true,
  planLabel: true,
  primaryDomain: true,
  status: true,
  startedAt: true,
  renewsAt: true,
  sslStatus: true,
  managementMode: true,
  dataSource: true,
  notes: true,
  projectId: true,
  managedDomainId: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true } },
  managedDomain: { select: { id: true, publicId: true, domainName: true } },
} as const

const domainCustomerSelect = {
  id: true,
  publicId: true,
  domainName: true,
  registrar: true,
  registeredAt: true,
  expiresAt: true,
  renewalStatus: true,
  nameservers: true,
  dnsProviderId: true,
  verificationStatus: true,
  dataSource: true,
  providerReference: true,
  createdAt: true,
  updatedAt: true,
} as const

const emailCustomerSelect = {
  id: true,
  publicId: true,
  providerId: true,
  planLabel: true,
  mailboxCount: true,
  renewsAt: true,
  status: true,
  externalProviderRef: true,
  dataSource: true,
  managedDomainId: true,
  managedDomain: { select: { id: true, publicId: true, domainName: true } },
  createdAt: true,
  updatedAt: true,
} as const

export async function getCustomerInfrastructureOverview(customerAccountId: string) {
  const [hosting, domains, email] = await Promise.all([
    prisma.hostingService.findMany({
      where: { customerAccountId },
      orderBy: { createdAt: 'desc' },
      select: hostingCustomerSelect,
    }),
    prisma.managedDomain.findMany({
      where: { customerAccountId },
      orderBy: { domainName: 'asc' },
      select: domainCustomerSelect,
    }),
    prisma.businessEmailService.findMany({
      where: { customerAccountId },
      orderBy: { createdAt: 'desc' },
      select: emailCustomerSelect,
    }),
  ])
  return { hosting, domains, email }
}

export async function getCustomerHostingService(publicId: string, customerAccountId: string) {
  return prisma.hostingService.findFirst({
    where: { publicId, customerAccountId },
    select: hostingCustomerSelect,
  })
}

export async function getCustomerManagedDomain(publicId: string, customerAccountId: string) {
  return prisma.managedDomain.findFirst({
    where: { publicId, customerAccountId },
    select: domainCustomerSelect,
  })
}

export async function getCustomerBusinessEmail(publicId: string, customerAccountId: string) {
  return prisma.businessEmailService.findFirst({
    where: { publicId, customerAccountId },
    select: emailCustomerSelect,
  })
}

export async function listAdminInfrastructure(filters?: { q?: string; customerAccountId?: string }) {
  const q = filters?.q?.trim()
  const customerAccountId = filters?.customerAccountId
  const customerFilter = customerAccountId ? { customerAccountId } : {}
  const searchOr = q
    ? {
        OR: [
          { publicId: { contains: q, mode: 'insensitive' as const } },
          { primaryDomain: { contains: q, mode: 'insensitive' as const } },
          { providerId: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const domainSearchOr = q
    ? {
        OR: [
          { publicId: { contains: q, mode: 'insensitive' as const } },
          { domainName: { contains: q, mode: 'insensitive' as const } },
          { registrar: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [hosting, domains, email, customers] = await Promise.all([
    prisma.hostingService.findMany({
      where: { ...customerFilter, ...searchOr },
      orderBy: { updatedAt: 'desc' },
      include: {
        customerAccount: { select: { id: true, businessName: true, slug: true } },
        project: { select: { id: true, name: true } },
        managedDomain: { select: { id: true, publicId: true, domainName: true } },
      },
    }),
    prisma.managedDomain.findMany({
      where: { ...customerFilter, ...domainSearchOr },
      orderBy: { updatedAt: 'desc' },
      include: {
        customerAccount: { select: { id: true, businessName: true, slug: true } },
        _count: { select: { hostingServices: true, businessEmailServices: true } },
      },
    }),
    prisma.businessEmailService.findMany({
      where: {
        ...customerFilter,
        ...(q
          ? {
              OR: [
                { publicId: { contains: q, mode: 'insensitive' } },
                { providerId: { contains: q, mode: 'insensitive' } },
                { planLabel: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        customerAccount: { select: { id: true, businessName: true, slug: true } },
        managedDomain: { select: { id: true, publicId: true, domainName: true } },
      },
    }),
    prisma.customerAccount.findMany({
      orderBy: { businessName: 'asc' },
      select: { id: true, businessName: true, slug: true },
    }),
  ])

  const infrastructureSupport = q
    ? await prisma.supportRequest.findMany({
        where: {
          subject: { contains: '[Infrastructure]', mode: 'insensitive' },
          ...(customerAccountId ? { customerAccountId } : {}),
          ...(q
            ? {
                OR: [
                  { subject: { contains: q, mode: 'insensitive' } },
                  { message: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          customerAccount: { select: { id: true, businessName: true } },
          project: { select: { id: true, name: true } },
        },
      })
    : await prisma.supportRequest.findMany({
        where: {
          subject: { contains: '[Infrastructure]', mode: 'insensitive' },
          ...(customerAccountId ? { customerAccountId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          customerAccount: { select: { id: true, businessName: true } },
          project: { select: { id: true, name: true } },
        },
      })

  return { hosting, domains, email, customers, infrastructureSupport }
}

export async function listCustomerProjectsForInfrastructure(customerAccountId: string) {
  return prisma.project.findMany({
    where: { customerAccountId, status: { in: ['ACTIVE', 'DRAFT', 'ON_HOLD'] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}
