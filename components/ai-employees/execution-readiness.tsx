'use client'

import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AiState, Section, StatusPill, TableFrame, th, td } from '@/components/ai-employees/ui'
import { FactRow, MetricSkeleton, Panel, SliceUnavailable } from '@/components/dashboard/readiness-kit'
import { fill } from '@/lib/commerce-ui/format'
import { useAiExecutionSummary, type AiWorkforceExecutionSlice, type AiWorkforceExecutionSummary } from '@/lib/ai-employees-ui/execution'
import type { AiEmployeesCopy } from '@/lib/i18n/dictionaries/ai-employees-en'
import type { AiWorkforceExecutionCopy } from '@/lib/i18n/dictionaries/ai-workforce-execution-en'
import type { PillTone } from '@/components/commerce/ui'

type Props = {
  accountId: string
  locale: string
  copy: AiWorkforceExecutionCopy
  aiCopy: AiEmployeesCopy
  loginHref: string
}

type Data<K extends keyof AiWorkforceExecutionSummary> = AiWorkforceExecutionSummary[K] extends AiWorkforceExecutionSlice<infer T> ? T : never

const EFFECT_TONE: Record<string, PillTone> = { READ: 'info', DRAFT: 'success', DENIED: 'danger', REGISTRY_ONLY: 'muted', DISABLED: 'muted' }
const GATE_KEYS = [
  'customerWorkforceEnabled',
  'customerExecutionEnabled',
  'customerOutboundEnabled',
  'pilotPrepEnabled',
  'durablePilotEnabled',
  'internalWorkforceEnabled',
  'paperclipExecutionEnabled',
  'autonomousProductionActions',
  'workflowWorkerEnabled',
  'workflowExternalEffectsEnabled',
] as const
const BLOCKED_KEYS = ['liveInferenceBlocked', 'outboundBlocked', 'externalEffectsBlocked'] as const

export function ExecutionReadiness({ accountId, locale, copy, aiCopy, loginHref }: Props) {
  const { summary, error, isValidating, mutate } = useAiExecutionSummary(accountId)
  const numberFormat = new Intl.NumberFormat(locale)

  return (
    <Section
      id="ai-workforce-readiness"
      title={copy.title}
      description={copy.description}
      action={
        <Button size="sm" variant="outline" disabled={isValidating} onClick={() => mutate()}>
          {isValidating && summary ? copy.refreshing : copy.refresh}
        </Button>
      }
    >
      {error ? (
        <AiState error={error} copy={aiCopy} compact onRetry={() => mutate()} loginHref={loginHref} />
      ) : !summary ? (
        <MetricSkeleton count={4} label={copy.loading} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted px-4 py-3 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground">{copy.executionOff.title}</p>
              <p className="leading-relaxed text-muted-foreground">{copy.executionOff.body}</p>
              <p className="text-xs text-muted-foreground">
                {copy.serverDisclosure}: {summary.disclosure}
              </p>
            </div>
          </div>

          <Stages copy={copy} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SlicePanel title={copy.approvals.title} slice={summary.approvalBoundary} copy={copy}>
              {(d) => <ApprovalFacts data={d} pause={summary.pauseControls} isolation={summary.billingIsolation} copy={copy} />}
            </SlicePanel>
            <SlicePanel title={copy.costs.title} note={copy.costs.note} slice={summary.costCeilings} copy={copy}>
              {(d) => <CostFacts data={d} copy={copy} format={(n) => fill(copy.costs.units, { value: numberFormat.format(n) })} locale={locale} />}
            </SlicePanel>
          </div>

          <SlicePanel title={copy.roles.title} note={copy.roles.note} slice={summary.internalRoles} copy={copy}>
            {(d) => (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {d.roles.map((role) => (
                  <li key={role.roleKey} className="flex flex-col gap-2 rounded-lg border p-3">
                    <p className="text-sm font-medium text-foreground">{copy.roles.keys[role.roleKey] ?? role.roleKey}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.paused && <StatusPill label={copy.roles.paused} tone="muted" />}
                      {!role.liveExecutionEnabled && <StatusPill label={copy.roles.liveOff} tone="muted" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {role.budgetLimitSubunits == null
                        ? copy.roles.noBudget
                        : fill(copy.roles.budget, { value: numberFormat.format(role.budgetLimitSubunits) })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SlicePanel>

          <SlicePanel title={copy.tools.title} note={copy.tools.note} slice={summary.toolCoverage} copy={copy}>
            {(d) => <ToolTable rows={d.rows} copy={copy} />}
          </SlicePanel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SlicePanel title={copy.automation.title} slice={summary.workflowHandoff} copy={copy}>
              {(d) => (
                <div className="flex flex-col gap-3">
                  <p className="text-sm leading-relaxed text-muted-foreground">{copy.automation.reasons[d.reason] ?? d.reason}</p>
                  <dl>
                    <FactRow label={copy.automation.handler} value={d.handler} />
                    <FactRow label={copy.automation.registered} value={d.registered ? copy.values.yes : copy.values.no} tone={d.registered ? 'info' : 'muted'} />
                    <FactRow label={copy.automation.queueState} value={copy.automation.states[d.state] ?? d.state} tone="muted" />
                    <FactRow label={copy.automation.attempts} value={numberFormat.format(d.attemptsExecuted)} />
                    <FactRow label={copy.automation.worker} value={d.workerEnabled ? copy.values.on : copy.values.off} tone={d.workerEnabled ? 'info' : 'muted'} />
                    <FactRow
                      label={copy.automation.effects}
                      value={d.externalEffectsEnabled ? copy.values.on : copy.values.off}
                      tone={d.externalEffectsEnabled ? 'info' : 'muted'}
                    />
                  </dl>
                </div>
              )}
            </SlicePanel>
            <SlicePanel title={copy.automation.storage} slice={summary.orchestrationPersistence} copy={copy}>
              {(d) => (
                <div className="flex flex-col gap-3">
                  <dl>
                    <FactRow label={copy.automation.storage} value={copy.automation.inMemory} tone="muted" />
                    <FactRow label={copy.automation.productionSafe} value={d.productionSafe ? copy.values.yes : copy.values.no} tone={d.productionSafe ? 'success' : 'muted'} />
                    <FactRow
                      label={copy.automation.durable}
                      value={d.durablePersistenceConnected ? copy.values.yes : copy.values.no}
                      tone={d.durablePersistenceConnected ? 'success' : 'muted'}
                    />
                    <FactRow
                      label={copy.automation.preparationRequests}
                      value={d.httpMutationsEnabled ? copy.values.on : copy.values.off}
                      tone={d.httpMutationsEnabled ? 'info' : 'muted'}
                    />
                  </dl>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {copy.unavailable.serverMessage}: {d.message}
                  </p>
                  <SliceStatus title={copy.automation.employeeRecords} slice={summary.customerEmployeePersistence} copy={copy} />
                </div>
              )}
            </SlicePanel>
          </div>

          <SlicePanel title={copy.gates.title} note={copy.gates.note} slice={summary.runtimeGates} copy={copy}>
            {(d) => (
              <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <dl>
                  {GATE_KEYS.map((key) => (
                    <FactRow key={key} label={copy.gates.labels[key]} value={d[key] ? copy.values.on : copy.values.off} tone={d[key] ? 'info' : 'muted'} />
                  ))}
                </dl>
                <dl className="self-start">
                  {BLOCKED_KEYS.map((key) => (
                    <FactRow key={key} label={copy.gates.blocked[key]} value={copy.gates.blockedValue} tone="neutral" />
                  ))}
                </dl>
              </div>
            )}
          </SlicePanel>
        </div>
      )}
    </Section>
  )
}

function Stages({ copy }: { copy: AiWorkforceExecutionCopy }) {
  const s = copy.stages
  const stages = [
    { ...s.prepare, status: s.available, tone: 'success' as PillTone },
    { ...s.approve, status: s.staffOnly, tone: 'info' as PillTone },
    { ...s.execute, status: s.disabled, tone: 'muted' as PillTone },
  ]
  return (
    <Panel title={s.title}>
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {stages.map((stage, i) => (
          <li key={stage.label} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                <span className="sr-only">{i + 1}. </span>
                {stage.label}
              </p>
              <StatusPill label={stage.status} tone={stage.tone} />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{stage.body}</p>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

function SlicePanel<T>({
  title,
  note,
  slice,
  copy,
  children,
}: {
  title: string
  note?: string
  slice: AiWorkforceExecutionSlice<T>
  copy: AiWorkforceExecutionCopy
  children: (data: T) => React.ReactNode
}) {
  return (
    <Panel title={title} note={note}>
      {slice.status === 'AVAILABLE' && slice.data !== undefined ? children(slice.data) : <Unavailable slice={slice} copy={copy} />}
    </Panel>
  )
}

function Unavailable({ slice, copy, title }: { slice: AiWorkforceExecutionSlice<unknown>; copy: AiWorkforceExecutionCopy; title?: string }) {
  return (
    <SliceUnavailable
      title={title ?? copy.unavailable.title}
      reason={slice.reasonCode ? copy.reasons[slice.reasonCode] : undefined}
      reasonCode={slice.reasonCode}
      message={slice.message}
      reasonLabel={copy.unavailable.reason}
      serverMessageLabel={copy.unavailable.serverMessage}
    />
  )
}

function SliceStatus({ title, slice, copy }: { title: string; slice: AiWorkforceExecutionSlice<unknown>; copy: AiWorkforceExecutionCopy }) {
  return slice.status === 'AVAILABLE' ? null : <Unavailable slice={slice} copy={copy} title={title} />
}

function ApprovalFacts({
  data,
  pause,
  isolation,
  copy,
}: {
  data: Data<'approvalBoundary'>
  pause: AiWorkforceExecutionSummary['pauseControls']
  isolation: AiWorkforceExecutionSummary['billingIsolation']
  copy: AiWorkforceExecutionCopy
}) {
  const a = copy.approvals
  const v = copy.values
  return (
    <dl>
      <FactRow label={a.promptMayApprove} value={data.promptMayApprove ? v.yes : v.no} tone={data.promptMayApprove ? 'danger' : 'muted'} />
      <FactRow label={a.cohort} value={data.open001Cohort} />
      <FactRow label={a.includedAgents} value={a.includedAgentsValue} />
      <FactRow label={a.paidSku} value={data.paidAiEmployeePurchasable ? v.yes : a.notPurchasable} tone="muted" />
      {isolation.status === 'AVAILABLE' && isolation.data && (
        <>
          <FactRow label={a.tenant} value={a.tenantValue} />
          <FactRow label={a.siblingAccess} value={isolation.data.billingGroupGrantsSiblingAiAccess ? v.yes : v.no} tone="muted" />
        </>
      )}
      {pause.status === 'AVAILABLE' && pause.data && (
        <>
          <FactRow label={a.agentSelfPause} value={pause.data.agentSelfPause ? v.yes : v.no} tone="muted" />
          <FactRow label={a.accountPaused} value={pause.data.accountPaused ? v.yes : v.no} tone={pause.data.accountPaused ? 'info' : 'muted'} />
        </>
      )}
    </dl>
  )
}

function CostFacts({
  data,
  copy,
  format,
  locale,
}: {
  data: Data<'costCeilings'>
  copy: AiWorkforceExecutionCopy
  format: (n: number) => string
  locale: string
}) {
  const c = copy.costs
  return (
    <dl>
      <FactRow
        label={c.customerCharge}
        value={new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(data.customerChargeUsd)}
      />
      <FactRow label={c.internalExpense} value={c.estimateOnly} tone="muted" />
      <FactRow label={c.softCeiling} value={format(data.accountSoftCeilingSubunits)} />
      <FactRow label={c.hardCeiling} value={format(data.accountHardCeilingSubunits)} />
      <FactRow label={c.globalLimit} value={format(data.globalLimitSubunits)} />
      <FactRow label={c.silentUpgrade} value={data.silentPaidUpgrade ? copy.values.yes : copy.values.never} tone="muted" />
    </dl>
  )
}

function ToolTable({ rows, copy }: { rows: Data<'toolCoverage'>['rows']; copy: AiWorkforceExecutionCopy }) {
  const t = copy.tools
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t.empty}</p>
  const prepare = rows.filter((r) => r.effect === 'READ' || r.effect === 'DRAFT').length
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{fill(t.counts, { prepare: String(prepare), restricted: String(rows.length - prepare) })}</p>
      <TableFrame label={t.title}>
        <thead>
          <tr>
            <th scope="col" className={th}>
              {t.tool}
            </th>
            <th scope="col" className={th}>
              {t.domain}
            </th>
            <th scope="col" className={th}>
              {t.capability}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.toolKey}>
              <td className={td}>
                <code className="font-mono text-xs text-foreground">{row.toolKey}</code>
              </td>
              <td className={`${td} text-muted-foreground`}>{row.domain}</td>
              <td className={td}>
                <StatusPill label={t.effects[row.effect] ?? row.effect} tone={EFFECT_TONE[row.effect] ?? 'muted'} />
              </td>
            </tr>
          ))}
        </tbody>
      </TableFrame>
    </div>
  )
}
