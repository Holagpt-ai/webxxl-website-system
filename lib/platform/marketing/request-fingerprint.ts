import { createHash } from 'node:crypto'
import type { MarketingRequestCategory } from '@/lib/platform/marketing/types'

export type MarketingRequestFingerprintInput = {
  customerAccountId: string
  managedSiteId?: string | null
  category: MarketingRequestCategory
  goal: string
  brief: string
  locale: string
  audience?: string | null
  sourceRefs: string[]
  seoOpportunityId?: string | null
  assignedWorkflow: string
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

export function computeMarketingRequestFingerprint(input: MarketingRequestFingerprintInput): string {
  const canonical = stableStringify({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId ?? null,
    category: input.category,
    goal: input.goal.trim(),
    brief: input.brief.trim(),
    locale: input.locale,
    audience: input.audience?.trim() ?? null,
    sourceRefs: [...input.sourceRefs].sort(),
    seoOpportunityId: input.seoOpportunityId ?? null,
    assignedWorkflow: input.assignedWorkflow,
  })
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}
