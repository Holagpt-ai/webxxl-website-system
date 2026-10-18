import { COMMS_QUOTE_MAX_RECIPIENTS } from '@/config/comms-backend'
import { prisma } from '@/lib/db'
import { buildSynthetic200ContactSegmentFixture } from '@/lib/platform/crm/test-fixtures-200'
import type { CommsResult } from '@/lib/platform/comms/types'
import type { CrmConsentChannel, CrmConsentPurpose } from '@prisma/client'

export async function prepareCommunicationQuote(input: {
  customerAccountId: string
  actorUserId: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  recipientContactIds?: string[]
  synthetic200?: boolean
}): Promise<
  CommsResult<{
    quoteId: string
    eligibleCount: number
    suppressedCount: number
    unknownConsentCount: number
    estimatedUnits: number
    policyDecision: string
    unitCostSource: string | null
  }>
> {
  let contactIds = input.recipientContactIds ?? []
  if (input.synthetic200) {
    const fixture = buildSynthetic200ContactSegmentFixture(input.customerAccountId)
    contactIds = fixture.slice(0, COMMS_QUOTE_MAX_RECIPIENTS).map((c) => c.id)
  }
  if (contactIds.length > COMMS_QUOTE_MAX_RECIPIENTS) {
    return { ok: false, code: 'VALIDATION', message: 'Recipient count exceeds quote bound' }
  }

  let eligibleCount = 0
  let suppressedCount = 0
  let unknownConsentCount = 0

  for (const contactId of contactIds) {
    const contact = await prisma.crmContact.findFirst({
      where: { id: contactId, customerAccountId: input.customerAccountId },
    })
    if (!contact) continue
    const suppressed = await prisma.contactSuppression.findFirst({
      where: { customerAccountId: input.customerAccountId, contactId, channel: input.channel, purpose: input.purpose },
    })
    if (suppressed) {
      suppressedCount += 1
      continue
    }
    const consent = await prisma.contactConsent.findFirst({
      where: { customerAccountId: input.customerAccountId, contactId, channel: input.channel, purpose: input.purpose },
      orderBy: { capturedAt: 'desc' },
    })
    if (!consent || consent.status !== 'GRANTED') {
      unknownConsentCount += 1
      if (input.purpose === 'MARKETING') continue
    }
    eligibleCount += 1
  }

  const unitCostSource = process.env.COMMS_UNIT_COST_SOURCE ?? null
  const policyDecision = unitCostSource ? 'ALLOW_PREPARATION' : 'COST_UNAVAILABLE'
  const expiresAt = new Date(Date.now() + 15 * 60_000)

  const quote = await prisma.communicationQuote.create({
    data: {
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      channel: input.channel,
      purpose: input.purpose,
      recipientCount: contactIds.length,
      eligibleCount,
      suppressedCount,
      unknownConsentCount,
      estimatedUnits: eligibleCount,
      unitCostSource,
      unitCostVersion: unitCostSource ? 'synthetic-v0' : null,
      policyDecision,
      expiresAt,
      detail: { synthetic200: Boolean(input.synthetic200) },
    },
  })

  return {
    ok: true,
    value: {
      quoteId: quote.id,
      eligibleCount,
      suppressedCount,
      unknownConsentCount,
      estimatedUnits: eligibleCount,
      policyDecision,
      unitCostSource,
    },
  }
}
