import { prisma } from '@/lib/db'
import type { CommsResult } from '@/lib/platform/comms/types'

export type ResolvedChatwootTenant = {
  tenantMappingId: string
  customerAccountId: string
  providerInstanceId: string
  externalAccountId: string
  authorizedInboxIds: string[]
  verificationState: string
}

/** Resolve WebXXL tenant from verified mapping; never trust payload account IDs alone. */
export async function resolveChatwootTenantByExternalAccount(input: {
  providerInstanceId: string
  externalAccountId: string
}): Promise<CommsResult<ResolvedChatwootTenant>> {
  const mapping = await prisma.chatwootTenantMapping.findFirst({
    where: {
      providerInstanceId: input.providerInstanceId,
      externalAccountId: input.externalAccountId,
      verificationState: 'VERIFIED',
      revokedAt: null,
    },
  })
  if (!mapping) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'No verified Chatwoot tenant mapping' }
  }
  const inboxIds = Array.isArray(mapping.authorizedInboxIds)
    ? (mapping.authorizedInboxIds as string[])
    : []
  return {
    ok: true,
    value: {
      tenantMappingId: mapping.id,
      customerAccountId: mapping.customerAccountId,
      providerInstanceId: mapping.providerInstanceId,
      externalAccountId: mapping.externalAccountId,
      authorizedInboxIds: inboxIds,
      verificationState: mapping.verificationState,
    },
  }
}

export async function assertInboxAuthorizedForTenant(
  tenant: ResolvedChatwootTenant,
  externalInboxId: string,
): Promise<CommsResult<true>> {
  if (!tenant.authorizedInboxIds.includes(externalInboxId)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Inbox not authorized for customer account mapping' }
  }
  const inbox = await prisma.chatwootInboxMapping.findFirst({
    where: {
      tenantMappingId: tenant.tenantMappingId,
      externalInboxId,
      verificationState: 'VERIFIED',
    },
  })
  if (!inbox || inbox.customerAccountId !== tenant.customerAccountId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Inbox mapping verification failed' }
  }
  return { ok: true, value: true }
}

/** Reject client-nominated Chatwoot account/inbox outside resolved tenant scope. */
export function rejectForgedChatwootScope(input: {
  resolvedExternalAccountId: string
  requestedExternalAccountId?: string
  requestedExternalInboxId?: string
  authorizedInboxIds: string[]
}): CommsResult<true> {
  if (
    input.requestedExternalAccountId &&
    input.requestedExternalAccountId !== input.resolvedExternalAccountId
  ) {
    return { ok: false, code: 'FORBIDDEN', message: 'Forged Chatwoot account reference' }
  }
  if (input.requestedExternalInboxId && !input.authorizedInboxIds.includes(input.requestedExternalInboxId)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Forged or unauthorized Chatwoot inbox reference' }
  }
  return { ok: true, value: true }
}
