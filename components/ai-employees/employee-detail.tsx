'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { aiBase, aiMutate, useAi, type AiEmployee, type AiErrorCode, type AiUsageSummary } from '@/lib/ai-employees-ui/client'
import { fill, formatDate, formatNumber } from '@/lib/commerce-ui/format'
import { AiState, Field, LoadingRows, StatusPill, lifecycleTone } from './ui'
import { LocalePicker } from './locale-picker'
import { ToolPermissions } from './tool-permissions'
import type { WorkforceContext } from './workforce-view'

type Status = AiEmployee['status']

const TRANSITIONS: Record<Status, Status[]> = {
  DRAFT: ['INACTIVE', 'ARCHIVED'],
  INACTIVE: ['ACTIVE', 'DRAFT', 'ARCHIVED'],
  ACTIVE: ['PAUSED', 'INACTIVE', 'ARCHIVED'],
  PAUSED: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
  ARCHIVED: [],
}

type Failure = { code: AiErrorCode; detail?: string } | null

export function EmployeeDetail({ employeeId, ctx, onChanged }: { employeeId: string; ctx: WorkforceContext; onChanged: () => void }) {
  const { copy, accountId } = ctx
  const url = `${aiBase(accountId)}/employees/${encodeURIComponent(employeeId)}`
  const { data: employee, error, isLoading, mutate } = useAi<AiEmployee>(url)

  if (error && !employee) return <div className="p-4"><AiState error={error} copy={copy} onRetry={() => mutate()} /></div>
  if (isLoading || !employee) return <div className="p-4"><LoadingRows rows={4} label={copy.common.loading} /></div>

  const update = (next: AiEmployee) => {
    mutate(next, { revalidate: false })
    onChanged()
  }

  return (
    <div className="flex flex-col gap-8 p-4">
      <ConfigForm key={employee.updatedAt} employee={employee} url={url} ctx={ctx} onSaved={update} />
      <Lifecycle employee={employee} url={url} ctx={ctx} onSaved={update} />
      <ToolPermissions employee={employee} ctx={ctx} />
      <EmployeeUsage employee={employee} ctx={ctx} />
    </div>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
}

function ConfigForm({ employee, url, ctx, onSaved }: { employee: AiEmployee; url: string; ctx: WorkforceContext; onSaved: (e: AiEmployee) => void }) {
  const { copy } = ctx
  const readOnly = employee.status === 'ARCHIVED'
  const [displayName, setDisplayName] = useState(employee.displayName)
  const [roleTitle, setRoleTitle] = useState(employee.roleTitle)
  const [description, setDescription] = useState(employee.description ?? '')
  const [primaryLocale, setPrimaryLocale] = useState(employee.primaryLocale)
  const [secondaryLocales, setSecondaryLocales] = useState(employee.secondaryLocales)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<Failure>(null)
  const [saved, setSaved] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!displayName.trim() || !roleTitle.trim()) {
      setFailure({ code: 'VALIDATION', detail: copy.form.required })
      return
    }
    setPending(true)
    setFailure(null)
    setSaved(false)
    const result = await aiMutate<AiEmployee>(url, 'PATCH', {
      displayName: displayName.trim(),
      roleTitle: roleTitle.trim(),
      description: description.trim() || null,
      primaryLocale,
      secondaryLocales: secondaryLocales.filter((tag) => tag !== primaryLocale),
    })
    setPending(false)
    if (!result.ok) return setFailure({ code: result.code, detail: result.detail })
    setSaved(true)
    onSaved(result.data)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <SubHeading>{copy.detail.configuration}</SubHeading>
      {readOnly && <p className="text-sm text-muted-foreground">{copy.detail.archivedReadOnly}</p>}
      <fieldset disabled={readOnly || pending} className="flex flex-col gap-4">
        <Field id="ai-edit-name" label={copy.form.name}>
          <Input id="ai-edit-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={120} />
        </Field>
        <Field id="ai-edit-role" label={copy.form.role}>
          <Input id="ai-edit-role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} maxLength={120} />
        </Field>
        <Field id="ai-edit-description" label={copy.form.description}>
          <Textarea id="ai-edit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} />
        </Field>
        <LocalePicker
          idPrefix="ai-edit"
          copy={copy}
          primary={primaryLocale}
          secondary={secondaryLocales}
          onPrimaryChange={setPrimaryLocale}
          onSecondaryChange={setSecondaryLocales}
          disabled={readOnly}
        />
      </fieldset>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{copy.common.reference}</dt>
          <dd className="font-mono text-xs text-foreground">{employee.publicId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{copy.common.updated}</dt>
          <dd className="text-foreground">{formatDate(employee.updatedAt, ctx.locale)}</dd>
        </div>
      </dl>
      {failure && <AiState compact code={failure.code} detail={failure.detail} copy={copy} />}
      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? copy.common.saving : copy.common.save}
          </Button>
          <span role="status" className="text-sm text-muted-foreground">
            {saved ? copy.common.saved : ''}
          </span>
        </div>
      )}
    </form>
  )
}

function Lifecycle({ employee, url, ctx, onSaved }: { employee: AiEmployee; url: string; ctx: WorkforceContext; onSaved: (e: AiEmployee) => void }) {
  const { copy, policy } = ctx
  const [pending, setPending] = useState<string | null>(null)
  const [failure, setFailure] = useState<Failure>(null)
  const next = TRANSITIONS[employee.status]
  const atLimit = policy.activeEmployeeCount >= policy.maxActiveEmployees && employee.status !== 'ACTIVE'

  const run = async (action: () => Promise<{ ok: true; data: AiEmployee } | { ok: false; code: AiErrorCode; detail?: string }>, key: string) => {
    setPending(key)
    setFailure(null)
    const result = await action()
    setPending(null)
    if (!result.ok) return setFailure({ code: result.code, detail: result.detail })
    onSaved(result.data)
  }

  const transition = (status: Status) => {
    if (status === 'ARCHIVED' && !window.confirm(copy.detail.archiveConfirm)) return
    run(() => aiMutate<AiEmployee>(`${url}/lifecycle`, 'POST', { status }), status)
  }

  return (
    <section aria-labelledby="ai-lifecycle-heading" className="flex flex-col gap-4">
      <h3 id="ai-lifecycle-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {copy.detail.lifecycle}
      </h3>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{copy.detail.lifecycleCurrent}</span>
          <StatusPill tone={lifecycleTone(employee.status)} label={copy.lifecycle[employee.status]} />
          {employee.emergencyPaused && <StatusPill tone="danger" label={copy.employees.emergencyPaused} />}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.lifecycleHelp[employee.status]}</p>
      </div>

      {next.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.detail.lifecycleNoActions}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {next.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === 'ACTIVE' ? 'default' : status === 'ARCHIVED' ? 'destructive' : 'outline'}
              disabled={pending !== null || (status === 'ACTIVE' && policy.emergencyDisabled)}
              onClick={() => transition(status)}
            >
              {pending === status ? copy.common.saving : copy.lifecycleActions[status]}
            </Button>
          ))}
        </div>
      )}

      {next.includes('ACTIVE') && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {atLimit ? fill(copy.detail.limitReached, { max: policy.maxActiveEmployees }) : copy.detail.activationNote}
        </p>
      )}

      {employee.status !== 'ARCHIVED' && (
        <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{copy.detail.emergencyPause}</p>
            <p className="text-xs text-muted-foreground">{copy.detail.emergencyPauseHelp}</p>
          </div>
          <Button
            size="sm"
            variant={employee.emergencyPaused ? 'outline' : 'destructive'}
            disabled={pending !== null}
            onClick={() => run(() => aiMutate<AiEmployee>(url, 'PATCH', { emergencyPaused: !employee.emergencyPaused }), 'emergency')}
          >
            {pending === 'emergency' ? copy.common.saving : employee.emergencyPaused ? copy.detail.emergencyOff : copy.detail.emergencyOn}
          </Button>
        </div>
      )}

      {failure && <AiState compact code={failure.code} detail={failure.detail} copy={copy} />}
    </section>
  )
}

function EmployeeUsage({ employee, ctx }: { employee: AiEmployee; ctx: WorkforceContext }) {
  const { copy, accountId, locale } = ctx
  const { data, error } = useAi<AiUsageSummary>(`${aiBase(accountId)}/usage-summary`)
  if (error) return null
  const row = data?.employees.find((e) => e.employeeId === employee.id)
  const stats = [
    [copy.usage.messages, row?.messagesIngested ?? 0],
    [copy.usage.tokens, row?.tokensReserved ?? 0],
    [copy.usage.toolsAuthorized, row?.toolCallsAuthorized ?? 0],
    [copy.usage.toolsDenied, row?.toolCallsDenied ?? 0],
  ] as const
  return (
    <section aria-labelledby="ai-emp-usage" className="flex flex-col gap-3">
      <h3 id="ai-emp-usage" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {copy.detail.usage}
        {data && <span className="ml-2 font-mono normal-case tracking-normal">{data.periodKey}</span>}
      </h3>
      <dl className="grid grid-cols-2 gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums text-foreground">{data ? formatNumber(value, locale) : '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
