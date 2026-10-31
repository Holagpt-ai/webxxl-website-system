import type { CrmConsentChannel, CrmConsentPurpose, CrmConsentStatus } from '@prisma/client'

export type MergeConsentRecord = {
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  status: CrmConsentStatus
  capturedAt: Date
  source: string
  termsVersion?: string | null
}

export type MergeSuppressionRecord = {
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  active: boolean
  source: string
  reason: string
}

export type MergeChatwootContactMapping = {
  chatwootContactId: string
  chatwootAccountId: string
}

export type MergePreflightConflict =
  | { kind: 'consent'; channel: CrmConsentChannel; purpose: CrmConsentPurpose; message: string }
  | { kind: 'chatwoot'; message: string }

function latestConsent(
  consents: MergeConsentRecord[],
  channel: CrmConsentChannel,
  purpose: CrmConsentPurpose,
): MergeConsentRecord | undefined {
  return consents
    .filter((row) => row.channel === channel && row.purpose === purpose)
    .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0]
}

export function isMarketingOutreachGranted(
  consents: MergeConsentRecord[],
  suppressions: MergeSuppressionRecord[],
  channel: CrmConsentChannel = 'EMAIL',
  purpose: CrmConsentPurpose = 'MARKETING',
): boolean {
  if (suppressions.some((row) => row.active && row.channel === channel && row.purpose === purpose)) {
    return false
  }
  return latestConsent(consents, channel, purpose)?.status === 'GRANTED'
}

export function evaluateMergeConsentCompatibility(input: {
  survivorConsents: MergeConsentRecord[]
  duplicateConsents: MergeConsentRecord[]
  survivorSuppressions: MergeSuppressionRecord[]
  duplicateSuppressions: MergeSuppressionRecord[]
}): MergePreflightConflict | null {
  const combinedConsents = [...input.survivorConsents, ...input.duplicateConsents]
  const combinedSuppressions = [...input.survivorSuppressions, ...input.duplicateSuppressions]

  const survivorGranted = isMarketingOutreachGranted(input.survivorConsents, input.survivorSuppressions)
  const combinedGranted = isMarketingOutreachGranted(combinedConsents, combinedSuppressions)
  if (!survivorGranted && combinedGranted) {
    return {
      kind: 'consent',
      channel: 'EMAIL',
      purpose: 'MARKETING',
      message: 'Merge would elevate marketing consent; reconcile consent history before merging',
    }
  }

  const channelPurposeKeys = new Set<string>()
  for (const row of combinedConsents) {
    channelPurposeKeys.add(`${row.channel}:${row.purpose}`)
  }

  for (const key of channelPurposeKeys) {
    const [channel, purpose] = key.split(':') as [CrmConsentChannel, CrmConsentPurpose]
    const survivorLatest = latestConsent(input.survivorConsents, channel, purpose)
    const duplicateLatest = latestConsent(input.duplicateConsents, channel, purpose)
    const combinedLatest = latestConsent(combinedConsents, channel, purpose)
    if (!survivorLatest || !duplicateLatest || !combinedLatest) continue
    if (survivorLatest.status === combinedLatest.status) continue
    if (survivorLatest.status === 'REVOKED' && combinedLatest.status === 'GRANTED') {
      return {
        kind: 'consent',
        channel,
        purpose,
        message: 'Merge would replace a revoked consent with a granted consent for the same channel and purpose',
      }
    }
  }

  return null
}

export function evaluateMergeChatwootCompatibility(input: {
  survivorMapping?: MergeChatwootContactMapping | null
  duplicateMapping?: MergeChatwootContactMapping | null
}): MergePreflightConflict | null {
  const survivor = input.survivorMapping
  const duplicate = input.duplicateMapping
  if (!survivor || !duplicate) return null
  if (survivor.chatwootContactId === duplicate.chatwootContactId) return null
  if (survivor.chatwootContactId !== duplicate.chatwootContactId) {
    return {
      kind: 'chatwoot',
      message:
        'Both contacts have different Chatwoot mappings; reconcile Chatwoot links manually before approving merge',
    }
  }
  return null
}
