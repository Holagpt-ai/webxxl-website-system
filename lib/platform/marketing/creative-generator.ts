import type { MarketingArtifactType } from '@prisma/client'
import type { MktResult } from '@/lib/platform/marketing/types'

export type LandingPageDraft = {
  pageObjective: string
  targetAudience: string
  primaryTopic: string
  title: string
  metaDescription: string
  h1: string
  h2Outline: string[]
  sections: { heading: string; bullets: string[] }[]
  internalLinkSuggestions: string[]
  cta: string
  structuredDataRecommendation: string
  evidenceRefs: string[]
  localeVariants?: { locale: 'en' | 'es'; title: string; metaDescription: string; h1: string }
}

export function generateDeterministicLandingPage(input: {
  goal: string
  audience?: string
  locale: 'en' | 'es'
  businessName: string
  approvedServices: string[]
  evidenceRefs: string[]
  affectedUrl?: string
}): MktResult<{ artifactType: 'LANDING_PAGE'; content: LandingPageDraft; generationMode: 'DETERMINISTIC_DRAFT' }> {
  const service = input.approvedServices[0] ?? 'core services'
  const title =
    input.locale === 'es'
      ? `${input.businessName} — ${service}`
      : `${input.businessName} | ${service}`
  const content: LandingPageDraft = {
    pageObjective: input.goal,
    targetAudience: input.audience ?? 'Prospective customers in authorized service area',
    primaryTopic: service,
    title,
    metaDescription: `Learn about ${service} from ${input.businessName}. ${input.goal}`.slice(0, 160),
    h1: title,
    h2Outline: ['Why choose us', 'Services', 'Next steps'],
    sections: [
      { heading: 'Why choose us', bullets: [`Trusted ${input.businessName} team`, 'Clear service scope'] },
      { heading: 'Services', bullets: input.approvedServices.slice(0, 5) },
      { heading: 'Next steps', bullets: ['Contact us', 'Schedule a consultation'] },
    ],
    internalLinkSuggestions: input.affectedUrl ? [input.affectedUrl, '/contact'] : ['/services', '/contact'],
    cta: 'Contact our team',
    structuredDataRecommendation: 'LocalBusiness or MedicalBusiness only when verified in brand context',
    evidenceRefs: input.evidenceRefs,
    localeVariants:
      input.locale === 'es'
        ? { locale: 'es', title, metaDescription: `Información sobre ${service}`, h1: title }
        : undefined,
  }
  return { ok: true, value: { artifactType: 'LANDING_PAGE', content, generationMode: 'DETERMINISTIC_DRAFT' } }
}

export function generateDeterministicAdCreative(input: {
  objective: string
  locale: 'en' | 'es'
  businessName: string
}): MktResult<{ artifactType: 'AD_CREATIVE'; content: Record<string, unknown>; generationMode: 'DETERMINISTIC_DRAFT' }> {
  return {
    ok: true,
    value: {
      artifactType: 'AD_CREATIVE',
      generationMode: 'DETERMINISTIC_DRAFT',
      content: {
        objective: input.objective,
        platformConcept: 'UNCONFIGURED_PAID_CHANNEL',
        headlines: [`${input.businessName}: ${input.objective}`.slice(0, 60)],
        captions: ['Draft creative — not launched', 'No ad spend authorized'],
        measurementSuggestions: ['Define conversion event before any paid activation'],
        regulatoryReviewRequired: true,
        paidExecution: 'BLOCKED',
      },
    },
  }
}

export function mapArtifactTypeForCategory(type: MarketingArtifactType): MarketingArtifactType {
  return type
}
