import type { SegmentContactView } from '@/lib/platform/crm/segment-engine'

/** Synthetic 200-contact dataset for segmentation tests (no production data). */
export function buildSynthetic200ContactSegmentFixture(accountId: string): SegmentContactView[] {
  const contacts: SegmentContactView[] = []
  for (let i = 0; i < 200; i += 1) {
    const mod = i % 10
    contacts.push({
      id: `syn_crm_${accountId}_${i + 1}`,
      customerAccountId: accountId,
      leadSource: mod === 0 ? 'referral' : 'website',
      createdAt: new Date(Date.UTC(2026, 0, 1 + (i % 28))),
      lastActivityAt: i % 7 === 0 ? undefined : new Date(Date.UTC(2026, 9, 1 + (i % 15))),
      tagLabels: mod === 2 ? ['vip'] : mod === 3 ? ['newsletter'] : [],
      hasOpenDeal: mod === 4,
      followUpCoverage: mod === 5 ? 'OVERDUE' : undefined,
      consents:
        mod === 1
          ? [{ channel: 'EMAIL', purpose: 'MARKETING', status: 'GRANTED', capturedAt: new Date(Date.UTC(2026, 1, 1)) }]
          : mod === 6
            ? [{ channel: 'EMAIL', purpose: 'MARKETING', status: 'UNKNOWN', capturedAt: new Date(Date.UTC(2026, 1, 1)) }]
            : [],
      suppressions: mod === 8 ? [{ channel: 'EMAIL', purpose: 'MARKETING', active: true }] : [],
    })
  }
  return contacts
}
