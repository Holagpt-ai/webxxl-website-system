import type { MktResult } from '@/lib/platform/marketing/types'

/** Versioned payload for ManagedSiteChange / project approval — no GitHub or publish side effects. */
export function buildLandingPageManagedSiteChangeHandoff(input: {
  customerAccountId: string
  managedSiteId: string
  marketingRequestId: string
  artifactRevisionHash: string
  structuredContent: Record<string, unknown>
}): MktResult<{ handoffKind: 'LANDING_PAGE_PROPOSAL'; payload: Record<string, unknown> }> {
  return {
    ok: true,
    value: {
      handoffKind: 'LANDING_PAGE_PROPOSAL',
      payload: {
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId,
        marketingRequestId: input.marketingRequestId,
        artifactRevisionHash: input.artifactRevisionHash,
        proposal: input.structuredContent,
        publishAuthorized: false,
        githubPrAuthorized: false,
        note: 'Prepared for ManagedSiteChange consumption; MKT-08 does not modify site files',
      },
    },
  }
}
