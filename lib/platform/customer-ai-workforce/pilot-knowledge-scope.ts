import type { KnowledgeRecord } from '@/lib/platform/customer-ai-workforce/store'

/** Approved non-sensitive business classifications for receptionist pilot reads (deny-by-default). */
export const PILOT_RECEPTIONIST_ALLOWED_KNOWLEDGE_CLASSIFICATIONS = ['GENERAL_BUSINESS'] as const

export type PilotReceptionistAllowedClassification =
  (typeof PILOT_RECEPTIONIST_ALLOWED_KNOWLEDGE_CLASSIFICATIONS)[number]

const DENIED_CLASSIFICATIONS = new Set([
  'SITE_RESTRICTED',
  'PHI',
  'REGULATED_HEALTHCARE',
  'CREDENTIAL',
  'CREDENTIALS',
  'BILLING',
  'SECURITY_AUDIT',
])

export function isPilotReceptionistAllowedKnowledgeClassification(classification: string): boolean {
  const normalized = classification.trim().toUpperCase()
  if (DENIED_CLASSIFICATIONS.has(normalized)) return false
  return (PILOT_RECEPTIONIST_ALLOWED_KNOWLEDGE_CLASSIFICATIONS as readonly string[]).includes(normalized)
}

/**
 * Published knowledge eligible for receptionist pilot reads.
 * Unknown or sensitive classifications are omitted fail-closed.
 */
export function filterPilotReceptionistKnowledge(
  published: Array<KnowledgeRecord & { latestContent: Record<string, unknown> }>,
  _managedSiteId: string | null,
): {
  items: typeof published
  omittedCount: number
  omittedClassifications: string[]
} {
  const omittedClassifications: string[] = []
  const items = published.filter((item) => {
    if (isPilotReceptionistAllowedKnowledgeClassification(item.classification)) return true
    omittedClassifications.push(item.classification)
    return false
  })
  return { items, omittedCount: omittedClassifications.length, omittedClassifications }
}
