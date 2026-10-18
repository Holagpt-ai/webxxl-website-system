import type { BoundedCrawlResult } from '@/lib/platform/seo/bounded-crawler'
import type { GscNormalizedRow } from '@/lib/platform/seo/gsc-types'

export type SeoOpportunityDraft = {
  ruleId: string
  ruleVersion: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  impactRationale: string
  effortCategory: 'QUICK' | 'MODERATE' | 'SUBSTANTIAL'
  recommendation: string
  affectedUrl?: string
  evidenceRef: string
  source: string
  observedAt: Date
  priorityScore: number
  state: 'OBSERVED_FINDING' | 'RECOMMENDED_ACTION'
}

const RULE_VERSION = 'seo-07-v1'

function priority(base: number, severity: SeoOpportunityDraft['severity'], confidence: SeoOpportunityDraft['confidence']): number {
  const sev = severity === 'HIGH' ? 30 : severity === 'MEDIUM' ? 20 : 10
  const conf = confidence === 'HIGH' ? 15 : confidence === 'MEDIUM' ? 10 : 5
  return base + sev + conf
}

export function detectCrawlOpportunities(crawl: BoundedCrawlResult, observedAt: Date): SeoOpportunityDraft[] {
  const out: SeoOpportunityDraft[] = []
  for (const page of crawl.pages) {
    if (!page.parsed.title) {
      out.push({
        ruleId: 'missing_title',
        ruleVersion: RULE_VERSION,
        severity: 'HIGH',
        confidence: 'HIGH',
        impactRationale: 'Missing title reduces clarity for search snippets.',
        effortCategory: 'QUICK',
        recommendation: 'Add a unique, descriptive title tag.',
        affectedUrl: page.url,
        evidenceRef: `crawl:${page.url}:title`,
        source: 'WEBXXL_CRAWL',
        observedAt,
        priorityScore: priority(100, 'HIGH', 'HIGH'),
        state: 'OBSERVED_FINDING',
      })
    }
    if (!page.parsed.h1) {
      out.push({
        ruleId: 'missing_h1',
        ruleVersion: RULE_VERSION,
        severity: 'MEDIUM',
        confidence: 'HIGH',
        impactRationale: 'Missing primary heading weakens on-page structure.',
        effortCategory: 'QUICK',
        recommendation: 'Add a single descriptive H1 aligned with page intent.',
        affectedUrl: page.url,
        evidenceRef: `crawl:${page.url}:h1`,
        source: 'WEBXXL_CRAWL',
        observedAt,
        priorityScore: priority(90, 'MEDIUM', 'HIGH'),
        state: 'OBSERVED_FINDING',
      })
    }
    if (!page.parsed.metaDescription) {
      out.push({
        ruleId: 'missing_meta_description',
        ruleVersion: RULE_VERSION,
        severity: 'MEDIUM',
        confidence: 'HIGH',
        impactRationale: 'Missing meta description may reduce CTR from search results.',
        effortCategory: 'QUICK',
        recommendation: 'Add a concise meta description for this URL.',
        affectedUrl: page.url,
        evidenceRef: `crawl:${page.url}:meta_description`,
        source: 'WEBXXL_CRAWL',
        observedAt,
        priorityScore: priority(85, 'MEDIUM', 'HIGH'),
        state: 'OBSERVED_FINDING',
      })
    }
    if (page.parsed.missingAltCount > 0) {
      out.push({
        ruleId: 'image_alt_gap',
        ruleVersion: RULE_VERSION,
        severity: 'LOW',
        confidence: 'MEDIUM',
        impactRationale: 'Images without alt text reduce accessibility and image context.',
        effortCategory: 'MODERATE',
        recommendation: 'Add descriptive alt attributes to content images.',
        affectedUrl: page.url,
        evidenceRef: `crawl:${page.url}:alt:${page.parsed.missingAltCount}`,
        source: 'WEBXXL_CRAWL',
        observedAt,
        priorityScore: priority(60, 'LOW', 'MEDIUM'),
        state: 'OBSERVED_FINDING',
      })
    }
  }
  for (const dup of crawl.duplicateTitles) {
    out.push({
      ruleId: 'duplicate_title',
      ruleVersion: RULE_VERSION,
      severity: 'MEDIUM',
      confidence: 'HIGH',
      impactRationale: 'Duplicate titles make it harder for search engines to differentiate pages.',
      effortCategory: 'MODERATE',
      recommendation: 'Assign unique titles across affected URLs.',
      evidenceRef: `crawl:duplicate_title:${dup.title}`,
      source: 'WEBXXL_CRAWL',
      observedAt,
      priorityScore: priority(95, 'MEDIUM', 'HIGH'),
      state: 'OBSERVED_FINDING',
    })
  }
  for (const broken of crawl.brokenInternalLinks) {
    out.push({
      ruleId: 'internal_broken_link',
      ruleVersion: RULE_VERSION,
      severity: 'HIGH',
      confidence: 'HIGH',
      impactRationale: 'Broken internal links harm navigation and crawl efficiency.',
      effortCategory: 'QUICK',
      recommendation: 'Fix or remove broken internal links.',
      affectedUrl: broken.fromUrl,
      evidenceRef: `crawl:${broken.fromUrl}->${broken.toUrl}:${broken.status}`,
      source: 'WEBXXL_CRAWL',
      observedAt,
      priorityScore: priority(110, 'HIGH', 'HIGH'),
      state: 'OBSERVED_FINDING',
    })
  }
  return out.sort((a, b) => b.priorityScore - a.priorityScore)
}

export function detectGscOpportunities(rows: GscNormalizedRow[], observedAt: Date): SeoOpportunityDraft[] {
  const out: SeoOpportunityDraft[] = []
  for (const row of rows) {
    if (!row.page || row.impressions == null || row.impressions < 100) continue
    if (row.ctr != null && row.ctr < 0.02 && row.impressions >= 500) {
      out.push({
        ruleId: 'low_ctr_high_impressions',
        ruleVersion: RULE_VERSION,
        severity: 'MEDIUM',
        confidence: 'MEDIUM',
        impactRationale: 'Strong impressions with weak CTR may indicate snippet or intent mismatch.',
        effortCategory: 'MODERATE',
        recommendation: 'Review title and meta description alignment for this query/page pair.',
        affectedUrl: row.page,
        evidenceRef: `gsc:${row.query ?? 'aggregate'}:${row.page}`,
        source: 'GSC',
        observedAt,
        priorityScore: priority(80, 'MEDIUM', 'MEDIUM'),
        state: 'RECOMMENDED_ACTION',
      })
    }
  }
  return out
}

export function sortOpportunitiesDeterministic(opportunities: SeoOpportunityDraft[]): SeoOpportunityDraft[] {
  return [...opportunities].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore
    return a.ruleId.localeCompare(b.ruleId)
  })
}
