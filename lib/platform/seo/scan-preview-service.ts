import { isSeoCrawlerEnabled } from '@/config/seo-backend'
import { prisma } from '@/lib/db'
import type { SeoResult } from '@/lib/platform/seo/types'

/** Prepare crawl intent only — no live production crawl in SEO-07 when crawler flag is off. */
export async function prepareSeoScanPreview(input: {
  customerAccountId: string
  managedSiteId: string
  idempotencyKey: string
  maxPages?: number
  maxDepth?: number
}): Promise<
  SeoResult<{
    crawlRunId: string
    status: 'PREPARED' | 'BLOCKED'
    message: string
  }>
> {
  const site = await prisma.managedSite.findFirst({
    where: { id: input.managedSiteId, customerAccountId: input.customerAccountId },
  })
  if (!site) return { ok: false, code: 'NOT_FOUND', message: 'Managed site not found' }

  const existing = await prisma.seoCrawlRun.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existing) {
    return {
      ok: true,
      value: {
        crawlRunId: existing.id,
        status: existing.status === 'BLOCKED' ? 'BLOCKED' : 'PREPARED',
        message: 'Idempotent crawl preparation returned existing run',
      },
    }
  }

  const blocked = !isSeoCrawlerEnabled()
  const run = await prisma.seoCrawlRun.create({
    data: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      idempotencyKey: input.idempotencyKey,
      maxPages: input.maxPages ?? 50,
      maxDepth: input.maxDepth ?? 3,
      status: blocked ? 'BLOCKED' : 'PREPARED',
      errorCode: blocked ? 'SEO_CRAWLER_DISABLED' : undefined,
    },
  })

  return {
    ok: true,
    value: {
      crawlRunId: run.id,
      status: blocked ? 'BLOCKED' : 'PREPARED',
      message: blocked ? 'Crawler activation disabled (SEO_CRAWLER_ENABLED=false)' : 'Crawl run prepared',
    },
  }
}
