'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { LoadingRows, Section, StatusPill } from '@/components/commerce/ui'
import { Facts, SuccessNote, WorkspaceState } from '@/components/crm/workspace-kit'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, fill, formatDateTime, workspaceSend } from '@/lib/crm-ui/workspace'
import { MKT_API, type MarketingRequest } from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { ArtifactsTable } from './deliverables'
import { REQUEST_TONE, flagBody, siteLabel } from './shared'

export function MarketingRequestDetail(props: MarketingViewProps & { requestId: string }) {
  const { accountId, locale, copy, base, seoBase, sites, requestId } = props
  const request = useWorkspace<{ request: MarketingRequest }>(MKT_API.request(requestId), accountId)
  const prepare = useAction<{ revisionNumber?: number }>()
  const q = copy.request
  const r = copy.requests
  const kit = copy.kit

  const back = (
    <Link className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })} href={`${base}/requests`}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {q.back}
      </Link>
  )

  if (request.isLoading) return <LoadingRows label={kit.loading} rows={4} />
  if (request.error || !request.data) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <WorkspaceState error={request.error} kit={kit} workspace={copy.name} onRetry={() => request.mutate()} />
      </div>
    )
  }

  const row = request.data.request

  return (
    <div className="flex flex-col gap-6">
      {back}
      <Section title={row.goal ?? q.facts}>
        <Facts
          items={[
            [r.status, <StatusPill key="s" label={enumLabel(copy.enums.requestStatus, row.status)} tone={REQUEST_TONE[row.status] ?? 'muted'} />],
            [r.category, enumLabel(copy.enums.category, row.requestType)],
            [r.site, siteLabel(sites, row.managedSiteId, r.noSite)],
            [r.language, enumLabel(copy.enums.locale, row.locale)],
            [r.audience, row.audience ?? DASH],
            [r.created_at, formatDateTime(row.createdAt, locale)],
            [
              q.opportunity,
              row.seoOpportunityId ? (
                <Link
                  key="o"
                  href={`${seoBase}/opportunities${row.managedSiteId ? `?site=${row.managedSiteId}` : ''}`}
                  className="font-mono text-xs underline underline-offset-4"
                >
                  {row.seoOpportunityId}
                </Link>
              ) : (
                DASH
              ),
            ],
          ]}
        />
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{row.brief}</p>
      </Section>

      <Section
        title={q.artifactsTitle}
        description={copy.flags.deterministic}
        action={
          <Button
            size="sm"
            disabled={prepare.pending}
            onClick={async () => {
              const result = await prepare.run(() => workspaceSend<{ revisionNumber?: number }>(MKT_API.prepare(requestId)))
              if (result.ok) request.mutate()
            }}
          >
            {prepare.pending ? q.preparing : q.prepare}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {prepare.data && <SuccessNote>{fill(q.prepared, { revision: prepare.data.revisionNumber ?? 1 })}</SuccessNote>}
          {prepare.error && (
            <WorkspaceState
              error={prepare.error}
              kit={kit}
              workspace={copy.name}
              body={flagBody(prepare.error, copy.flags.draftPreparation)}
              compact
            />
          )}
          <ArtifactsTable {...props} request={row} refreshKey={prepare.data ? 1 : 0} emptyText={q.artifactsEmpty} />
        </div>
      </Section>
    </div>
  )
}
