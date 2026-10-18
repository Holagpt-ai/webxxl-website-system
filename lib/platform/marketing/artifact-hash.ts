import { createHash } from 'node:crypto'

export type ArtifactHashInput = {
  customerAccountId: string
  managedSiteId?: string | null
  marketingRequestId?: string | null
  artifactType: string
  locale: string
  structuredContent: unknown
  mediaRefs?: unknown
  ctaDestinations?: unknown
  channelPlacement?: string | null
  brandContextVersionId?: string | null
  complianceVersion: string
  targetAudience?: string | null
  generationPolicyVersion: string
}

/** Deterministic canonical serialization (sorted keys) before SHA-256. */
export function computeMarketingArtifactRevisionHash(input: ArtifactHashInput): string {
  const canonical = stableStringify({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId ?? null,
    marketingRequestId: input.marketingRequestId ?? null,
    artifactType: input.artifactType,
    locale: input.locale,
    structuredContent: input.structuredContent,
    mediaRefs: input.mediaRefs ?? null,
    ctaDestinations: input.ctaDestinations ?? null,
    channelPlacement: input.channelPlacement ?? null,
    brandContextVersionId: input.brandContextVersionId ?? null,
    complianceVersion: input.complianceVersion,
    targetAudience: input.targetAudience ?? null,
    generationPolicyVersion: input.generationPolicyVersion,
  })
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}
