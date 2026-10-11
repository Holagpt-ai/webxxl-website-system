'use server'

import { revalidatePath } from 'next/cache'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { createServiceOrderRequest } from '@/lib/marketplace/orders'

export type MarketplaceCustomerActionResult =
  | { ok: true; duplicate: boolean; publicId: string; orderId: string }
  | { ok: false; error: string }

function revalidateMarketplace() {
  revalidatePath('/dashboard/services')
  revalidatePath('/es/dashboard/services')
}

export async function requestMarketplaceServiceAction(input: {
  serviceKey: string
  projectId?: string
  customerNotes?: string
}): Promise<MarketplaceCustomerActionResult> {
  try {
    const portal = await requireCustomerMembership()
    const result = await createServiceOrderRequest({
      actorUserId: portal.id,
      customerAccountId: portal.customerAccount.id,
      serviceKey: input.serviceKey,
      projectId: input.projectId || null,
      customerNotes: input.customerNotes,
    })
    if (!result.ok) return { ok: false, error: result.error }
    revalidateMarketplace()
    return {
      ok: true,
      duplicate: result.duplicate,
      publicId: result.publicId,
      orderId: result.orderId,
    }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
