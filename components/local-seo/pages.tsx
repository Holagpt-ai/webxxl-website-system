'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  EmptyNote,
  FormActions,
  LoadingRows,
  PlainTable,
  Section,
  SelectField,
  StatusPill,
  SuccessNote,
  TextField,
  WorkspaceState,
  td,
} from '@/components/crm/workspace-kit'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, fill, formatDateTime, newIdempotencyKey, withQuery, workspaceSend } from '@/lib/crm-ui/workspace'
import { SEO_API, type PageFinding, type ScanPreviewResult, type SitePage } from '@/lib/local-seo-ui/types'
import type { SeoViewProps } from '@/lib/local-seo-ui/server'
import { LEVEL_TONE, SiteBar, useSelectedSite } from './shared'

const TAKE = 100
const STATUSES = ['DISCOVERED', 'CRAWLED', 'DRAFT', 'PREVIEW', 'PUBLISHED', 'REMOVED', 'UNVERIFIED']

export function SeoPagesView({ accountId, locale, copy, sites }: SeoViewProps) {
  const siteId = useSelectedSite(sites)
  const [status, setStatus] = useState('')
  const p = copy.pages
  const kit = copy.kit
  const pages = useWorkspace<{ pages: SitePage[] }>(
    siteId ? withQuery(SEO_API.pages(siteId), { take: TAKE, status: status || null }) : null,
    accountId,
  )
  const findings = useWorkspace<{ findings: PageFinding[] }>(
    siteId ? withQuery(SEO_API.findings(siteId), { take: TAKE }) : null,
    accountId,
  )

  return (
    <SiteBar sites={sites} siteId={siteId} kit={kit}>
      <Section title={p.inventoryTitle} description={p.inventoryBody}>
        <div className="flex flex-col gap-4">
          <div className="max-w-xs">
            <SelectField
              label={p.statusFilter}
              value={status}
              onChange={setStatus}
              options={[{ value: '', label: p.allStatuses }, ...STATUSES.map((s) => ({ value: s, label: enumLabel(copy.pageStatus, s) }))]}
            />
          </div>
          {pages.isLoading ? (
            <LoadingRows label={kit.loading} rows={4} />
          ) : pages.error ? (
            <WorkspaceState error={pages.error} kit={kit} workspace={copy.name} compact onRetry={() => pages.mutate()} />
          ) : !pages.data?.pages.length ? (
            <EmptyNote>{p.noPages}</EmptyNote>
          ) : (
            <>
              <PlainTable label={p.inventoryTitle} headers={[p.url, p.status, p.http, p.lastCrawled, p.lastPublished]}>
                {pages.data.pages.map((row) => (
                  <tr key={row.id}>
                    <td className={td}>
                      <span className="block font-medium">{row.title ?? row.normalizedPath}</span>
                      <span className="block break-all text-xs text-muted-foreground">{row.url}</span>
                    </td>
                    <td className={td}>
                      <StatusPill label={enumLabel(copy.pageStatus, row.status)} tone={row.status === 'PUBLISHED' ? 'success' : 'muted'} />
                    </td>
                    <td className={td}>{row.httpStatus ?? DASH}</td>
                    <td className={td}>{formatDateTime(row.lastCrawledAt, locale)}</td>
                    <td className={td}>{formatDateTime(row.lastPublishedAt, locale)}</td>
                  </tr>
                ))}
              </PlainTable>
              {pages.data.pages.length >= TAKE && <p className="text-xs text-muted-foreground">{fill(kit.listCapped, { count: TAKE })}</p>}
            </>
          )}
        </div>
      </Section>

      <Section title={p.findingsTitle} description={p.findingsBody}>
        {findings.isLoading ? (
          <LoadingRows label={kit.loading} rows={3} />
        ) : findings.error ? (
          <WorkspaceState error={findings.error} kit={kit} workspace={copy.name} compact onRetry={() => findings.mutate()} />
        ) : !findings.data?.findings.length ? (
          <EmptyNote>{p.noFindings}</EmptyNote>
        ) : (
          <PlainTable label={p.findingsTitle} headers={[p.rule, p.severity, p.url, p.observed]}>
            {findings.data.findings.map((f) => (
              <tr key={f.id}>
                <td className={td}>{f.ruleId}</td>
                <td className={td}>
                  <StatusPill label={enumLabel(copy.level, f.severity)} tone={LEVEL_TONE[f.severity] ?? 'muted'} />
                </td>
                <td className={`${td} break-all`}>{f.url}</td>
                <td className={td}>{formatDateTime(f.observedAt, locale)}</td>
              </tr>
            ))}
          </PlainTable>
        )}
      </Section>

      {siteId && <ScanPreview key={siteId} siteId={siteId} copy={copy} />}
    </SiteBar>
  )
}

function ScanPreview({ siteId, copy }: { siteId: string; copy: SeoViewProps['copy'] }) {
  const [maxPages, setMaxPages] = useState('')
  const [maxDepth, setMaxDepth] = useState('')
  const scan = useAction<ScanPreviewResult>()
  const p = copy.pages
  const toInt = (v: string) => (v.trim() && Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : undefined)

  return (
    <Section title={p.scanTitle} description={p.scanBody}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          await scan.run(() =>
            workspaceSend<ScanPreviewResult>(SEO_API.scanPreviews(siteId), {
              idempotencyKey: newIdempotencyKey(),
              maxPages: toInt(maxPages),
              maxDepth: toInt(maxDepth),
            }),
          )
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={p.maxPages} type="number" value={maxPages} onChange={setMaxPages} hint={copy.kit.optional} />
          <TextField label={p.maxDepth} type="number" value={maxDepth} onChange={setMaxDepth} hint={copy.kit.optional} />
        </div>
        {scan.data &&
          (scan.data.status === 'PREPARED' ? (
            <SuccessNote>{p.prepared}</SuccessNote>
          ) : (
            <p role="status" className="text-sm leading-relaxed text-muted-foreground">
              {fill(p.blocked, { message: scan.data.message })}
            </p>
          ))}
        {scan.error && <WorkspaceState error={scan.error} kit={copy.kit} workspace={copy.name} compact />}
        <FormActions>
          <Button type="submit" disabled={scan.pending}>
            {scan.pending ? p.preparing : p.prepare}
          </Button>
        </FormActions>
      </form>
    </Section>
  )
}
