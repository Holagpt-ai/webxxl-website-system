import { isSeoCrawlerEnabled } from '@/config/seo-backend'
import { prisma } from '@/lib/db'
import { buildScanRequestFingerprint, normalizeScanResourceLimits } from '@/lib/platform/seo/scan-limits'
import type { SeoResult } from '@/lib/platform/seo/types'

const SCAN_OPERATION = 'SCAN_PREVIEW'

/** Prepare crawl intent only — no live production crawl when crawler flag is off. */
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

  const limits = normalizeScanResourceLimits({ maxPages: input.maxPages, maxDepth: input.maxDepth })
  if (!limits.ok) return limits

  const requestFingerprint = buildScanRequestFingerprint({
    operation: SCAN_OPERATION,
    maxPages: limits.value.maxPages,
    maxDepth: limits.value.maxDepth,
  })

  const globalKey = await prisma.seoCrawlRun.findFirst({
    where: { idempotencyKey: input.idempotencyKey },
  })
  if (globalKey) {
    const sameScope =
      globalKey.customerAccountId === input.customerAccountId &&
      globalKey.managedSiteId === input.managedSiteId
    if (!sameScope) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'Idempotency key already used for a different account or site',
      }
    }
    if (globalKey.requestFingerprint !== requestFingerprint || globalKey.operation !== SCAN_OPERATION) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'Idempotency key reused with different scan parameters',
      }
    }
    return {
      ok: true,
      value: {
        crawlRunId: globalKey.id,
        status: globalKey.status === 'BLOCKED' ? 'BLOCKED' : 'PREPARED',
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
      operation: SCAN_OPERATION,
      requestFingerprint,
      maxPages: limits.value.maxPages,
      maxDepth: limits.value.maxDepth,
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
