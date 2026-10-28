'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyNote, LoadingRows, Section, StatusPill, td } from '@/components/commerce/ui'
import {
  GapNotice,
  PlainTable,
  SectionHeading,
  StatTile,
  SuccessNote,
  WorkspaceState,
} from '@/components/crm/workspace-kit'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import {
  DASH,
  enumLabel,
  fill,
  formatDateTime,
  formatNumber,
  isGateError,
  newIdempotencyKey,
  workspaceSend,
} from '@/lib/crm-ui/workspace'
import {
  MKT_API,
  type EvaluateResult,
  type FollowUpEvaluation,
  type MarketingRequest,
} from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { flagBody } from './shared'

const OPEN = new Set(['SUBMITTED', 'VALIDATING', 'PREPARING', 'IN_REVIEW', 'REVISION_REQUESTED'])
const READY = new Set(['DRAFT_READY', 'AWAITING_REVIEW'])
const DONE = new Set(['APPROVED', 'HANDED_OFF', 'COMPLETED'])

export function MarketingOverview({ accountId, userId, locale, copy, base }: MarketingViewProps) {
  const requests = useWorkspace<{ requests: MarketingRequest[] }>(MKT_API.requests, accountId)
  const followUps = useWorkspace<{ evaluations: FollowUpEvaluation[] }>(MKT_API.followUps, accountId)
  const evaluate = useAction<EvaluateResult>()
  const o = copy.overview
  const kit = copy.kit

  if (isGateError(requests.error)) {
    return <WorkspaceState error={requests.error} kit={kit} workspace={copy.name} />
  }

  const rows = requests.data?.requests ?? []
  const count = (set: Set<string>) => formatNumber(rows.filter((r) => set.has(r.status)).length, locale)

  return (
    <div className="flex flex-col gap-6">
      <GapNotice title={copy.title} body={copy.flags.deterministic} />

      <Section
        title={o.requestsTitle}
        description={o.requestsBody}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`${base}/requests`}>{o.viewAll}</Link>
          </Button>
        }
      >
        {requests.isLoading ? (
          <LoadingRows label={kit.loading} rows={2} />
        ) : requests.error ? (
          <WorkspaceState error={requests.error} kit={kit} workspace={copy.name} compact onRetry={() => requests.mutate()} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label={o.total} value={formatNumber(rows.length, locale)} />
            <StatTile label={o.open} value={count(OPEN)} />
            <StatTile label={o.ready} value={count(READY)} />
            <StatTile label={o.approved} value={count(DONE)} />
          </div>
        )}
      </Section>

      <Section
        title={o.followUpsTitle}
        description={o.followUpsBody}
        action={
          <Button
            size="sm"
            disabled={evaluate.pending}
            onClick={async () => {
              const result = await evaluate.run(() =>
                workspaceSend<EvaluateResult>(MKT_API.evaluate, { idempotencyKey: newIdempotencyKey() }),
              )
              if (result.ok) followUps.mutate()
            }}
          >
            {evaluate.pending ? o.evaluating : o.evaluate}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {evaluate.data && <SuccessNote>{fill(o.evaluated, { count: evaluate.data.rows.length })}</SuccessNote>}
          {evaluate.error && (
            <WorkspaceState
              error={evaluate.error}
              kit={kit}
              workspace={copy.name}
              body={flagBody(evaluate.error, copy.flags.leadMonitor)}
              compact
            />
          )}
          {followUps.isLoading ? (
            <LoadingRows label={kit.loading} rows={3} />
          ) : followUps.error ? (
            <WorkspaceState error={followUps.error} kit={kit} workspace={copy.name} compact onRetry={() => followUps.mutate()} />
          ) : !followUps.data?.evaluations.length ? (
            <EmptyNote>{o.noFollowUps}</EmptyNote>
          ) : (
            <PlainTable label={o.followUpsTitle} headers={[o.contact, o.coverage, o.due, o.recommended, o.actions]}>
              {followUps.data.evaluations.map((row) => (
                <FollowUpRow
                  key={row.id}
                  row={row}
                  userId={userId}
                  copy={copy}
                  locale={locale}
                  onPrepared={() => followUps.mutate()}
                />
              ))}
            </PlainTable>
          )}
        </div>
      </Section>
    </div>
  )
}

function FollowUpRow({
  row,
  userId,
  copy,
  locale,
  onPrepared,
}: {
  row: FollowUpEvaluation
  userId: string
  copy: MarketingViewProps['copy']
  locale: string
  onPrepared: () => void
}) {
  const action = useAction<{ prepared: boolean; existed?: boolean }>()
  const o = copy.overview
  const prepared = row.resolutionState === 'TASK_PREPARED'

  return (
    <tr>
      <td className={`${td} font-mono text-xs`}>{row.crmContactId}</td>
      <td className={td}>
        <StatusPill
          label={enumLabel(copy.enums.coverage, row.coverageState)}
          tone={row.coverageState === 'OVERDUE' ? 'danger' : row.coverageState === 'COMPLETED' ? 'success' : 'neutral'}
        />
      </td>
      <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.dueAt, locale)}</td>
      <td className={td}>{row.recommendedAction ?? DASH}</td>
      <td className={td}>
        <div className="flex flex-col gap-1.5">
          {prepared || action.data ? (
            <span className="text-sm text-muted-foreground">{action.data?.existed ? o.taskExisted : o.taskPrepared}</span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={action.pending}
              onClick={async () => {
                const result = await action.run(() =>
                  workspaceSend(MKT_API.prepareTask(row.id), { assignedUserId: userId, idempotencyKey: newIdempotencyKey() }),
                )
                if (result.ok) onPrepared()
              }}
            >
              {action.pending ? o.preparingTask : o.prepareTask}
            </Button>
          )}
          {action.error && (
            <WorkspaceState
              error={action.error}
              kit={copy.kit}
              workspace={copy.name}
              body={flagBody(action.error, copy.flags.leadMonitor)}
              compact
            />
          )}
        </div>
      </td>
    </tr>
  )
}

export function MarketingHeading({ title, description }: { title: string; description: string }) {
  return <SectionHeading title={title} description={description} />
}
