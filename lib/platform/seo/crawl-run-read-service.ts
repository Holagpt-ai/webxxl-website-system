import { prisma } from '@/lib/db'
import { requireManagedSiteInAccount } from '@/lib/platform/seo/site-scope'
import type { SeoResult } from '@/lib/platform/seo/types'

export type SeoCrawlRunSummary = {
  id: string
  status: string
  operation: string
  maxPages: number
  maxDepth: number
  pagesCrawled: number
  bytesDownloaded: number
  startedAt: string | null
  finishedAt: string | null
  errorCode: string | null
  createdAt: string
  liveCrawlOccurred: false
}

export type SeoCrawlRunResultDto = SeoCrawlRunSummary & {
  findingsCount: number
  inventoryPagesTouched: number
  message: string
  provenance: 'STORED_CRAWL_RUN'
}

const CRAWL_LIST_TAKE = 25

export async function listSeoCrawlRunsForSite(input: {
  customerAccountId: string
  managedSiteId: string
}): Promise<SeoResult<{ crawlRuns: SeoCrawlRunSummary[] }>> {
  const site = await requireManagedSiteInAccount({
    siteId: input.managedSiteId,
    customerAccountId: input.customerAccountId,
  })
  if (!site.ok) return site

  const runs = await prisma.seoCrawlRun.findMany({
    where: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
    },
    orderBy: { createdAt: 'desc' },
    take: CRAWL_LIST_TAKE,
  })

  return {
    ok: true,
    value: {
      crawlRuns: runs.map((run) => ({
        id: run.id,
        status: run.status,
        operation: run.operation,
        maxPages: run.maxPages,
        maxDepth: run.maxDepth,
        pagesCrawled: run.pagesCrawled,
        bytesDownloaded: run.bytesDownloaded,
        startedAt: run.startedAt?.toISOString() ?? null,
        finishedAt: run.finishedAt?.toISOString() ?? null,
        errorCode: run.errorCode,
        createdAt: run.createdAt.toISOString(),
        liveCrawlOccurred: false as const,
      })),
    },
  }
}

function crawlStatusMessage(status: string, errorCode: string | null): string {
  switch (status) {
    case 'PREPARED':
      return 'Crawl run prepared; no live crawl executed without owner crawler activation.'
    case 'BLOCKED':
      return errorCode === 'SEO_CRAWLER_DISABLED'
        ? 'Crawler activation disabled (SEO_CRAWLER_ENABLED=false).'
        : 'Crawl blocked by policy.'
    case 'RUNNING':
      return 'Crawl marked running in persistence only when worker activation is authorized.'
    case 'COMPLETED':
      return 'Stored crawl run completed; findings reflect persisted inventory only.'
    case 'FAILED':
      return 'Stored crawl run failed; no synthetic page metrics applied.'
    default:
      return 'Crawl status from stored record.'
  }
}

export async function getSeoCrawlRunResult(input: {
  customerAccountId: string
  managedSiteId: string
  crawlRunId: string
}): Promise<SeoResult<SeoCrawlRunResultDto>> {
  const site = await requireManagedSiteInAccount({
    siteId: input.managedSiteId,
    customerAccountId: input.customerAccountId,
  })
  if (!site.ok) return site

  const run = await prisma.seoCrawlRun.findFirst({
    where: {
      id: input.crawlRunId,
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
    },
  })
  if (!run) {
    return { ok: false, code: 'NOT_FOUND', message: 'Crawl run not found' }
  }

  const [findingsCount, inventoryPagesTouched] = await Promise.all([
    prisma.seoPageFinding.count({ where: { crawlRunId: run.id } }),
    prisma.seoPageFinding.findMany({
      where: { crawlRunId: run.id },
      select: { pageInventoryId: true },
      distinct: ['pageInventoryId'],
    }),
  ])

  return {
    ok: true,
    value: {
      id: run.id,
      status: run.status,
      operation: run.operation,
      maxPages: run.maxPages,
      maxDepth: run.maxDepth,
      pagesCrawled: run.pagesCrawled,
      bytesDownloaded: run.bytesDownloaded,
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      errorCode: run.errorCode,
      createdAt: run.createdAt.toISOString(),
      liveCrawlOccurred: false,
      findingsCount,
      inventoryPagesTouched: inventoryPagesTouched.filter((row) => row.pageInventoryId != null).length,
      message: crawlStatusMessage(run.status, run.errorCode),
      provenance: 'STORED_CRAWL_RUN',
    },
  }
}