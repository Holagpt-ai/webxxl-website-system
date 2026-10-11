'use server'

import { revalidatePath } from 'next/cache'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { isEnabled } from '@/config/features'
import {
  createInfrastructureSupportRequest,
  isInfrastructureRequestType,
} from '@/lib/infrastructure/requests'
export type InfrastructureCustomerActionResult =
  | { ok: true; duplicate: boolean; supportRequestId: string }
  | { ok: false; error: string }

function revalidateInfrastructure() {
  revalidatePath('/dashboard/infrastructure')
  revalidatePath('/es/dashboard/infrastructure')
  revalidatePath('/dashboard/infrastructure/hosting')
  revalidatePath('/es/dashboard/infrastructure/hosting')
  revalidatePath('/dashboard/infrastructure/domains')
  revalidatePath('/es/dashboard/infrastructure/domains')
  revalidatePath('/dashboard/infrastructure/email')
  revalidatePath('/es/dashboard/infrastructure/email')
}

export async function submitInfrastructureRequestAction(input: {
  locale: string
  type: string
  message: string
  projectId?: string
  assetPublicId?: string
}): Promise<InfrastructureCustomerActionResult> {
  if (!isEnabled('infrastructureManagement')) return { ok: false, error: 'disabled' }
  if (!isInfrastructureRequestType(input.type)) return { ok: false, error: 'invalid_type' }

  try {
    const portal = await requireCustomerMembership()
    const loc = input.locale === 'es' ? 'es' : 'en'
    const result = await createInfrastructureSupportRequest({
      customerAccountId: portal.customerAccount.id,
      actorUserId: portal.id,
      type: input.type,
      locale: loc,
      message: input.message,
      projectId: input.projectId || null,
      assetPublicId: input.assetPublicId || null,
    })
    if (!result.ok) return result
    revalidateInfrastructure()
    return { ok: true, duplicate: result.duplicate, supportRequestId: result.supportRequestId }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
