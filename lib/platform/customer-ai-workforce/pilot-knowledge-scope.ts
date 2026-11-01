import type { KnowledgeRecord } from '@/lib/platform/customer-ai-workforce/store'

/**
 * Published knowledge eligible for receptionist pilot reads.
 * SITE_RESTRICTED items require verifiable site ownership — not modeled on knowledge rows; excluded fail-closed.
 */
export function filterPilotReceptionistKnowledge(
  published: Array<KnowledgeRecord & { latestContent: Record<string, unknown> }>,
  managedSiteId: string | null,
): { items: typeof published; siteRestrictedOmitted: number; unverifiedSiteScope: boolean } {
  let siteRestrictedOmitted = 0
  for (const item of published) {
    if (item.classification === 'SITE_RESTRICTED') siteRestrictedOmitted += 1
  }
  const items = published.filter((item) => item.classification !== 'SITE_RESTRICTED')
  const unverifiedSiteScope = siteRestrictedOmitted > 0 && managedSiteId != null
  return { items, siteRestrictedOmitted, unverifiedSiteScope }
}
