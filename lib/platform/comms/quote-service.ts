import { COMMS_QUOTE_MAX_RECIPIENTS, isCommsSyntheticQuoteAllowed } from '@/config/comms-backend'
import { prisma } from '@/lib/db'
import { evaluateSynthetic200Quote } from '@/lib/platform/comms/quote-synthetic'
import type { CommsResult } from '@/lib/platform/comms/types'
import type { CrmConsentChannel, CrmConsentPurpose } from '@prisma/client'

export async function prepareCommunicationQuote(input: {
  customerAccountId: string
  actorUserId: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  recipientContactIds?: string[]
  synthetic200?: boolean
  allowSyntheticEvaluation?: boolean
}): Promise<
  CommsResult<{
    quoteId: string
    eligibleCount: number
    suppressedCount: number
    unknownConsentCount: number
    invalidContactCount: number
    estimatedUnits: number
    policyDecision: string
    unitCostSource: string | null
  }>
> {
  if (input.synthetic200) {
    if (!input.allowSyntheticEvaluation || !isCommsSyntheticQuoteAllowed()) {
      return { ok: false, code: 'FORBIDDEN', message: 'Synthetic quote evaluation is not enabled' }
    }
    const synthetic = evaluateSynthetic200Quote({
      customerAccountId: input.customerAccountId,
      channel: input.channel,
      purpose: input.purpose,
    })
    const unitCostSource = process.env.COMMS_UNIT_COST_SOURCE ?? null
    const policyDecision = unitCostSource ? 'ALLOW_PREPARATION' : 'COST_UNAVAILABLE'
    const quote = await prisma.communicationQuote.create({
      data: {
        customerAccountId: input.customerAccountId,
        actorUserId: input.actorUserId,
        channel: input.channel,
        purpose: input.purpose,
        recipientCount: synthetic.recipientCount,
        eligibleCount: synthetic.eligibleCount,
        suppressedCount: synthetic.suppressedCount,
        unknownConsentCount: synthetic.unknownConsentCount,
        estimatedUnits: synthetic.eligibleCount,
        unitCostSource,
        unitCostVersion: unitCostSource ? 'synthetic-v0' : null,
        ratePlanVersion: unitCostSource ? 'wallet09-fixture-v1' : null,
        policyDecision,
        expiresAt: new Date(Date.now() + 15 * 60_000),
        detail: {
          synthetic200: true,
          invalidContactCount: synthetic.invalidContactCount,
          unitsPerRecipient: 1,
          totalEstimatedUnits: synthetic.eligibleCount,
        },
      },
    })
    return {
      ok: true,
      value: {
        quoteId: quote.id,
        eligibleCount: synthetic.eligibleCount,
        suppressedCount: synthetic.suppressedCount,
        unknownConsentCount: synthetic.unknownConsentCount,
        invalidContactCount: synthetic.invalidContactCount,
        estimatedUnits: synthetic.eligibleCount,
        policyDecision,
        unitCostSource,
      },
    }
  }

  const contactIds = input.recipientContactIds ?? []
  if (contactIds.length > COMMS_QUOTE_MAX_RECIPIENTS) {
    return { ok: false, code: 'VALIDATION', message: 'Recipient count exceeds quote bound' }
  }

  let eligibleCount = 0
  let suppressedCount = 0
  let unknownConsentCount = 0
  let invalidContactCount = 0

  for (const contactId of contactIds) {
    const contact = await prisma.crmContact.findFirst({
      where: { id: contactId, customerAccountId: input.customerAccountId },
    })
    if (!contact) {
      invalidContactCount += 1
      continue
    }
    const suppressed = await prisma.contactSuppression.findFirst({
      where: {
        customerAccountId: input.customerAccountId,
        contactId,
        channel: input.channel,
        purpose: input.purpose,
        active: true,
      },
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
      ratePlanVersion: unitCostSource ? 'wallet09-fixture-v1' : null,
      policyDecision,
      expiresAt,
      detail: {
        invalidContactCount,
        unitsPerRecipient: 1,
        totalEstimatedUnits: eligibleCount,
      },
    },
  })

  return {
    ok: true,
    value: {
      quoteId: quote.id,
      eligibleCount,
      suppressedCount,
      unknownConsentCount,
      invalidContactCount,
      estimatedUnits: eligibleCount,
      policyDecision,
      unitCostSource,
    },
  }
}
