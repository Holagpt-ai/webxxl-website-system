import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Batch 9B marketing review detail API', () => {
  it('exposes GET /api/v1/marketing/reviews/:id with marketing.read gate', () => {
    const route = readFileSync(
      join(process.cwd(), 'app/api/v1/marketing/reviews/[id]/route.ts'),
      'utf8',
    )
    expect(route).toContain('getMarketingReviewForAccount')
    expect(route).toContain("requireMktApiActor('marketing.read')")
    expect(route).toContain('export async function GET')
  })

  it('wires direct review fetch in Marketing Approvals UI', () => {
    const ui = readFileSync(join(process.cwd(), 'components/marketing-studio/approvals.tsx'), 'utf8')
    expect(ui).toContain('MKT_API.review')
    expect(ui).toContain('MarketingReviewDetailResponse')
  })
})