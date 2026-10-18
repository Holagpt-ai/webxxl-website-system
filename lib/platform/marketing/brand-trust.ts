import type { MarketingBrandContextVersion } from '@prisma/client'
import type { MktResult } from '@/lib/platform/marketing/types'

export type BrandDraftTrust = {
  businessName: string
  approvedServices: string[]
  approvedClaims: string[]
  brandContextVersionId?: string
  trustLevel: 'COMPLIANCE_APPROVED' | 'OWNER_SUBMITTED' | 'UNVERIFIED_FALLBACK'
  requiresHumanReview: boolean
}

const APPROVED_COMPLIANCE_STATES = new Set(['APPROVED', 'COMPLIANCE_APPROVED'])

export function isBrandContextComplianceApproved(brand: Pick<MarketingBrandContextVersion, 'complianceReviewState'>): boolean {
  return APPROVED_COMPLIANCE_STATES.has(brand.complianceReviewState.toUpperCase())
}

export function resolveBrandDraftTrust(brand: MarketingBrandContextVersion | null): MktResult<BrandDraftTrust> {
  if (!brand) {
    return {
      ok: true,
      value: {
        businessName: 'Authorized business',
        approvedServices: ['Professional services'],
        approvedClaims: [],
        trustLevel: 'UNVERIFIED_FALLBACK',
        requiresHumanReview: true,
      },
    }
  }

  const regulated =
    brand.complianceReviewState === 'REQUIRES_REVIEW' ||
    (brand.approvedClaims as string[] | null)?.some((c) => /\b(medical|health|trial|clinical)\b/i.test(c))

  if (regulated && !isBrandContextComplianceApproved(brand)) {
    return {
      ok: true,
      value: {
        businessName: brand.businessName,
        approvedServices: (brand.approvedServices as string[] | null) ?? [],
        approvedClaims: [],
        brandContextVersionId: brand.id,
        trustLevel: 'OWNER_SUBMITTED',
        requiresHumanReview: true,
      },
    }
  }

  if (isBrandContextComplianceApproved(brand)) {
    return {
      ok: true,
      value: {
        businessName: brand.businessName,
        approvedServices: (brand.approvedServices as string[] | null) ?? [],
        approvedClaims: (brand.approvedClaims as string[] | null) ?? [],
        brandContextVersionId: brand.id,
        trustLevel: 'COMPLIANCE_APPROVED',
        requiresHumanReview: false,
      },
    }
  }

  return {
    ok: true,
    value: {
      businessName: brand.businessName,
      approvedServices: (brand.approvedServices as string[] | null) ?? [],
      approvedClaims: [],
      brandContextVersionId: brand.id,
      trustLevel: 'OWNER_SUBMITTED',
      requiresHumanReview: true,
    },
  }
}
