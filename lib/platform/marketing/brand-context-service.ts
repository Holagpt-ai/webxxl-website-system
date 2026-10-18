import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { assertManagedSiteInAccount } from '@/lib/platform/marketing/account-isolation'
import { assertMarketingContentAllowed } from '@/lib/platform/marketing/content-safety'
import type { MktResult } from '@/lib/platform/marketing/types'
import { getManagedSiteForAccount } from '@/lib/managed-sites/queries'

export async function createMarketingBrandContextVersion(input: {
  customerAccountId: string
  managedSiteId?: string
  businessName: string
  locale: 'en' | 'es'
  approvedServices?: string[]
  operatingGeography?: Record<string, unknown>
  businessCategory?: string
  audience?: string
  brandTone?: string
  approvedClaims?: string[]
  excludedTopics?: string[]
  userId?: string
}): Promise<MktResult<{ versionId: string; versionNumber: number }>> {
  if (input.managedSiteId) {
    const site = await assertManagedSiteInAccount({
      siteId: input.managedSiteId,
      customerAccountId: input.customerAccountId,
      loadSite: (id, acct) => getManagedSiteForAccount(id, acct),
    })
    if (!site.ok) return site
  }

  const safe = assertMarketingContentAllowed({
    text: `${input.businessName} ${(input.approvedClaims ?? []).join(' ')}`,
    allowRegulated: true,
  })
  if (!safe.ok) return safe

  const latest = await prisma.marketingBrandContextVersion.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId ?? null,
      locale: input.locale,
    },
    orderBy: { versionNumber: 'desc' },
  })
  const versionNumber = (latest?.versionNumber ?? 0) + 1
  const row = await prisma.marketingBrandContextVersion.create({
    data: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      versionNumber,
      businessName: input.businessName,
      approvedServices: input.approvedServices ?? [],
      operatingGeography: input.operatingGeography as Prisma.InputJsonValue | undefined,
      businessCategory: input.businessCategory,
      audience: input.audience,
      locale: input.locale,
      brandTone: input.brandTone,
      approvedClaims: input.approvedClaims ?? [],
      excludedTopics: input.excludedTopics ?? [],
      sourceProvenance: 'owner_submitted:mkt-08',
      createdByUserId: input.userId,
      complianceReviewState: safe.value.safetyClass === 'REGULATED_HEALTHCARE' ? 'REQUIRES_REVIEW' : 'PENDING',
    },
  })
  return { ok: true, value: { versionId: row.id, versionNumber } }
}
