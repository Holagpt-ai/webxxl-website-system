import { prisma } from '@/lib/db'
import { isCommsIntegrationGatesEnabled, isCommunicationsOutboundEnabled } from '@/config/comms-backend'
import type { CommsResult } from '@/lib/platform/comms/types'

export type CrmContactCommunicationHandoff = {
  contactId: string
  deliveryBlocked: true
  liveDispatchAllowed: false
  integrationGatesEnabled: boolean
  outboundModuleEnabled: boolean
  prepareQuotePath: string
  prepareIntentPath: string
  providerReadinessPath: '/api/v1/communications/provider-readiness'
  executionSummaryPath: '/api/v1/communications/execution/summary'
  supportedChannels: Array<'EMAIL' | 'SMS' | 'WHATSAPP'>
  identitiesPresent: { email: boolean; phone: boolean; whatsapp: boolean }
  limitations: string[]
}

export async function buildCrmContactCommunicationHandoff(input: {
  customerAccountId: string
  contactId: string
}): Promise<CommsResult<CrmContactCommunicationHandoff>> {
  const contact = await prisma.crmContact.findFirst({
    where: { id: input.contactId, customerAccountId: input.customerAccountId, status: 'ACTIVE' },
    select: { id: true },
  })
  if (!contact) {
    return { ok: false, code: 'NOT_FOUND', message: 'Contact not found for account' }
  }
  const identities = await prisma.crmContactChannelIdentity.findMany({
    where: { customerAccountId: input.customerAccountId, contactId: input.contactId },
    select: { identityType: true },
  })
  const types = new Set(identities.map((row) => row.identityType))
  const limitations: string[] = [
    'Outbound preparation never authorizes live SMS, email, or Chatwoot dispatch while execution gates remain off.',
    'Consent, suppression, wallet, and sender eligibility are evaluated server-side on prepare routes; this contract is read-only.',
  ]
  if (!isCommsIntegrationGatesEnabled()) {
    limitations.push('COMMS_INTEGRATION_GATES_ENABLED is false — quote and intent preparation remain blocked.')
  }
  return {
    ok: true,
    value: {
      contactId: input.contactId,
      deliveryBlocked: true,
      liveDispatchAllowed: false,
      integrationGatesEnabled: isCommsIntegrationGatesEnabled(),
      outboundModuleEnabled: isCommunicationsOutboundEnabled(),
      prepareQuotePath: '/api/v1/communications/quotes',
      prepareIntentPath: '/api/v1/communications/intents',
      providerReadinessPath: '/api/v1/communications/provider-readiness',
      executionSummaryPath: '/api/v1/communications/execution/summary',
      supportedChannels: ['EMAIL', 'SMS', 'WHATSAPP'],
      identitiesPresent: {
        email: types.has('EMAIL'),
        phone: types.has('PHONE'),
        whatsapp: types.has('WHATSAPP'),
      },
      limitations,
    },
  }
}