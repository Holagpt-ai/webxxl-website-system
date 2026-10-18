import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import type { SeoPageInventoryStatus } from '@prisma/client'

export const SYNTHETIC_SITE_AESTHETICS = 'site_abmed_aesthetics_seo'
export const SYNTHETIC_SITE_PHYSICIANS = 'site_abmed_physicians_seo'

/** Fixture-only page inventory counts (24 discovered / 3 draft / 2 published). */
export function buildSyntheticPageInventoryFixture(): { status: SeoPageInventoryStatus; count: number }[] {
  return [
    { status: 'DISCOVERED', count: 19 },
    { status: 'CRAWLED', count: 5 },
    { status: 'DRAFT', count: 3 },
    { status: 'PUBLISHED', count: 2 },
  ]
}

export function buildAbmedSeoSiblingIsolationCase() {
  return {
    billingGroupSiblingAccounts: new Map([
      [ABMED_GROUP_ID, [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID, ABMED_CLINICAL_ACCOUNT_ID]],
    ]),
    aestheticsAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    physiciansAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
  }
}

export const MOCK_GSC_RESPONSE = {
  rows: [
    {
      keys: ['webxxl demo query', 'https://example.test/services'],
      clicks: 12,
      impressions: 800,
      ctr: 0.015,
      position: 8.2,
    },
    {
      keys: ['brand term', 'https://example.test/'],
      clicks: 40,
      impressions: 500,
      ctr: 0.08,
      position: 3.1,
    },
  ],
  responseAggregationType: 'byProperty',
}
