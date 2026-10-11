import { prisma } from '@/lib/db'
import type { ServiceOrderStatus } from '@prisma/client'

const customerOrderSelect = {
  id: true,
  publicId: true,
  serviceKey: true,
  status: true,
  customerNotes: true,
  quoteAmountCents: true,
  quoteCurrency: true,
  quoteNotes: true,
  projectId: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true } },
} as const

export async function listCustomerServiceOrders(customerAccountId: string) {
  return prisma.serviceOrder.findMany({
    where: { customerAccountId },
    orderBy: { createdAt: 'desc' },
    select: customerOrderSelect,
  })
}

export async function listAdminServiceOrders(filters?: { status?: ServiceOrderStatus; q?: string }) {
  const q = filters?.q?.trim()
  return prisma.serviceOrder.findMany({
    where: {
      status: filters?.status,
      ...(q
        ? {
            OR: [
              { publicId: { contains: q, mode: 'insensitive' } },
              { serviceKey: { contains: q, mode: 'insensitive' } },
              { customerAccount: { businessName: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      customerAccount: { select: { id: true, businessName: true, slug: true } },
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  })
}

export async function getAdminServiceOrderDetail(orderId: string) {
  return prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: {
      customerAccount: { select: { id: true, businessName: true, slug: true } },
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      activities: {
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
    },
  })
}

export async function getCustomerServiceOrder(orderId: string, customerAccountId: string) {
  return prisma.serviceOrder.findFirst({
    where: { id: orderId, customerAccountId },
    select: {
      ...customerOrderSelect,
      activities: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          summary: true,
          createdAt: true,
        },
      },
    },
  })
}
