import type { MarketingContentSafetyClass } from '@prisma/client'
import type { MktResult } from '@/lib/platform/marketing/types'

const PHI_PATTERN = /\b(patient|diagnosis|mrn|hipaa|phi|clinical trial participant|participant id)\b/i
const UNSUPPORTED_CLINICAL = /\b(cure|guaranteed results|fda approved for you|100% effective)\b/i
const AD_SPEND_PATTERN = /\b(launch campaign|buy ads|charge card|ad spend|meta ads api|google ads api)\b/i

export function classifyMarketingContentSafety(text: string): MarketingContentSafetyClass {
  if (PHI_PATTERN.test(text)) return 'PROHIBITED_CONTENT'
  if (UNSUPPORTED_CLINICAL.test(text)) return 'REGULATED_HEALTHCARE'
  if (/\b(trial|healthcare|medical|clinic)\b/i.test(text)) return 'REQUIRES_HUMAN_REVIEW'
  return 'GENERAL_BUSINESS'
}

export function assertMarketingContentAllowed(input: {
  text: string
  allowRegulated?: boolean
}): MktResult<{ safetyClass: MarketingContentSafetyClass }> {
  const safetyClass = classifyMarketingContentSafety(input.text)
  if (safetyClass === 'PROHIBITED_CONTENT') {
    return { ok: false, code: 'PHI_DENIED', message: 'Prohibited PHI or participant content' }
  }
  if (safetyClass === 'REGULATED_HEALTHCARE' && !input.allowRegulated) {
    return { ok: false, code: 'BLOCKED', message: 'Unsupported clinical claims require verified review' }
  }
  if (AD_SPEND_PATTERN.test(input.text)) {
    return { ok: false, code: 'AD_SPEND_DENIED', message: 'Paid ad execution is not authorized in marketing preparation' }
  }
  return { ok: true, value: { safetyClass } }
}
