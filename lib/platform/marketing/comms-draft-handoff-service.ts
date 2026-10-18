import { isCommunicationsOutboundEnabled } from '@/config/comms-backend'
import { prepareCommunicationIntent } from '@/lib/platform/comms/gateway-service'
import type { CrmConsentChannel, CrmConsentPurpose } from '@prisma/client'
import type { MktResult } from '@/lib/platform/marketing/types'

export async function prepareMarketingOutreachDraft(input: {
  customerAccountId: string
  actorUserId: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  crmContactId: string
  recipientAddress: string
  contentVersion: string
  idempotencyKey: string
}): Promise<MktResult<{ intentId: string; status: string; sendEligible: boolean }>> {
  const prepared = await prepareCommunicationIntent({
    customerAccountId: input.customerAccountId,
    actorUserId: input.actorUserId,
    channel: input.channel,
    purpose: input.purpose,
    crmContactId: input.crmContactId,
    recipientAddress: input.recipientAddress,
    contentVersion: input.contentVersion,
    policyVersion: 'mkt-08-v1',
    idempotencyKey: input.idempotencyKey,
  })
  if (!prepared.ok) {
    return { ok: false, code: 'BLOCKED', message: prepared.message }
  }
  return {
    ok: true,
    value: {
      intentId: prepared.value.intentId,
      status: prepared.value.status,
      sendEligible: isCommunicationsOutboundEnabled() && prepared.value.policyDecision === 'ALLOW',
    },
  }
}
