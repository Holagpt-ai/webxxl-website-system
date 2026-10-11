'use server'

import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/lib/portal/authz'
import type { ServiceOrderStatus } from '@prisma/client'
import {
  activateServiceOrderEntitlement,
  assignServiceOrder,
  setServiceOrderQuote,
  transitionServiceOrderStatus,
} from '@/lib/marketplace/orders'
export type MarketplaceAdminActionResult = { ok: true } | { ok: false; error: string }

function revalidateAdminMarketplace() {
  revalidatePath('/admin/service-orders')
  revalidatePath('/es/admin/service-orders')
}

export async function updateServiceOrderStatusAction(
  orderId: string,
  nextStatus: ServiceOrderStatus,
  internalNote?: string,
): Promise<MarketplaceAdminActionResult> {
  try {
    const staff = await requireStaff()
    const result = await transitionServiceOrderStatus({
      orderId,
      actorUserId: staff.id,
      nextStatus,
      internalNote,
    })
    if (!result.ok) return result
    revalidateAdminMarketplace()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function assignServiceOrderAction(orderId: string, assignedToId: string | null): Promise<MarketplaceAdminActionResult> {
  try {
    const staff = await requireStaff()
    const result = await assignServiceOrder({ orderId, actorUserId: staff.id, assignedToId: assignedToId || null })
    if (!result.ok) return result
    revalidateAdminMarketplace()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function setServiceOrderQuoteAction(input: {
  orderId: string
  quoteAmountCents: number | null
  quoteCurrency?: string
  quoteNotes?: string
}): Promise<MarketplaceAdminActionResult> {
  try {
    const staff = await requireStaff()
    const result = await setServiceOrderQuote({ ...input, actorUserId: staff.id })
    if (!result.ok) return result
    revalidateAdminMarketplace()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function activateServiceOrderEntitlementAction(orderId: string): Promise<MarketplaceAdminActionResult> {
  try {
    const staff = await requireStaff()
    const result = await activateServiceOrderEntitlement({ orderId, actorUserId: staff.id })
    if (!result.ok) return result
    revalidateAdminMarketplace()
    revalidatePath('/admin/customers')
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
