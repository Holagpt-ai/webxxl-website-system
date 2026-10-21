'use client'

import { aiBase, useAi, withPage, type AiEmployee, type AiUsageSummary, type PageResult } from '@/lib/ai-employees-ui/client'
import { fill, formatNumber } from '@/lib/commerce-ui/format'
import { AiState, EmptyNote, LoadingRows, Section, StatusPill, TableFrame, td, th } from './ui'
import type { WorkforceContext } from './workforce-view'

export function UsagePanel({ ctx }: { ctx: WorkforceContext }) {
  const { copy, accountId, locale, policy } = ctx
  const { data, error, mutate } = useAi<AiUsageSummary>(`${aiBase(accountId)}/usage-summary`)
  const employees = useAi<PageResult<AiEmployee>>(withPage(`${aiBase(accountId)}/employees`, 100, 0))
  const nameOf = (id: string, publicId: string) => employees.data?.items.find((e) => e.id === id)?.displayName ?? publicId

  const limits: Array<[string, string]> = [
    [copy.usage.activeEmployees, fill(copy.usage.activeOfMax, { active: policy.activeEmployeeCount, max: policy.maxActiveEmployees })],
    [copy.usage.messageBudget, policy.monthlyMessageBudget != null ? formatNumber(policy.monthlyMessageBudget, locale) : copy.usage.notSet],
    [copy.usage.tokenBudget, policy.monthlyTokenBudget != null ? formatNumber(policy.monthlyTokenBudget, locale) : copy.usage.notSet],
    [copy.usage.rateLimit, fill(copy.usage.rateLimitValue, { n: policy.rateLimitPerMinute })],
  ]

  const switches: Array<[string, boolean, 'onOff' | 'emergency']> = [
    [copy.usage.platformExecution, policy.flags.executionEnabled, 'onOff'],
    [copy.usage.accountExecution, policy.executionEnabled, 'onOff'],
    [copy.usage.outbound, policy.flags.outboundEnabled, 'onOff'],
    [copy.usage.chatwoot, policy.flags.chatwootAdapterEnabled, 'onOff'],
    [copy.usage.emergency, policy.emergencyDisabled, 'emergency'],
  ]

  return (
    <div className="flex flex-col gap-8">
      <Section title={copy.usage.title} description={copy.usage.description}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {limits.map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-card p-4">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-card-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={copy.usage.controls}>
        <ul className="flex flex-col divide-y rounded-lg border">
          {switches.map(([label, value, kind]) => (
            <li key={label} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-foreground">{label}</span>
              {kind === 'emergency' ? (
                <StatusPill tone={value ? 'danger' : 'muted'} label={value ? copy.usage.active : copy.usage.clear} />
              ) : (
                <StatusPill tone={value ? 'success' : 'muted'} label={value ? copy.usage.on : copy.usage.off} />
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={copy.usage.perEmployee} description={data ? `${copy.usage.period}: ${data.periodKey}` : undefined}>
        {error && !data ? (
          <AiState error={error} copy={copy} onRetry={() => mutate()} />
        ) : !data ? (
          <LoadingRows label={copy.usage.loading} />
        ) : data.employees.length === 0 ? (
          <EmptyNote>{copy.usage.perEmployeeEmpty}</EmptyNote>
        ) : (
          <TableFrame label={copy.usage.perEmployee}>
            <thead>
              <tr>
                <th className={th}>{copy.usage.employee}</th>
                <th className={`${th} text-right`}>{copy.usage.messages}</th>
                <th className={`${th} text-right`}>{copy.usage.tokens}</th>
                <th className={`${th} text-right`}>{copy.usage.toolsAuthorized}</th>
                <th className={`${th} text-right`}>{copy.usage.toolsDenied}</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((row) => (
                <tr key={row.employeeId} className="border-t">
                  <td className={`${td} font-medium text-foreground`}>{nameOf(row.employeeId, row.publicId)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatNumber(row.messagesIngested, locale)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatNumber(row.tokensReserved, locale)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatNumber(row.toolCallsAuthorized, locale)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatNumber(row.toolCallsDenied, locale)}</td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </Section>
    </div>
  )
}
