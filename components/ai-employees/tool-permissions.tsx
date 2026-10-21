'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { aiBase, aiMutate, useAi, type AiEmployee, type AiErrorCode, type AiToolPermissionsResponse } from '@/lib/ai-employees-ui/client'
import type { AiEmployeesCopy } from '@/lib/i18n/dictionaries/ai-employees-en'
import { AiState, LoadingRows, StatusPill } from './ui'
import type { WorkforceContext } from './workforce-view'

function domainLabel(copy: AiEmployeesCopy, domain: string) {
  return copy.tools.domains[domain as keyof AiEmployeesCopy['tools']['domains']] ?? domain
}

export function ToolPermissions({ employee, ctx }: { employee: AiEmployee; ctx: WorkforceContext }) {
  const { copy, accountId, policy } = ctx
  const url = `${aiBase(accountId)}/employees/${encodeURIComponent(employee.id)}/tool-permissions`
  const { data, error, isLoading, mutate } = useAi<AiToolPermissionsResponse>(url)
  const [pending, setPending] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ code: AiErrorCode; detail?: string } | null>(null)
  const readOnly = employee.status === 'ARCHIVED'
  const executionLive = policy.flags.executionEnabled && policy.executionEnabled && !policy.emergencyDisabled

  const toggle = async (toolKey: string, accessMode: string, granted: boolean) => {
    setPending(toolKey)
    setFailure(null)
    const result = await aiMutate(url, 'PUT', { toolKey, accessMode, granted })
    setPending(null)
    if (!result.ok) return setFailure({ code: result.code, detail: result.detail })
    mutate()
  }

  const grantedCount = data?.permissions.filter((p) => p.granted).length ?? 0

  return (
    <section aria-labelledby="ai-tools-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="ai-tools-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {copy.tools.title}
        </h3>
        {data && <span className="text-xs text-muted-foreground">{copy.employees.capabilitiesCount.replace('{count}', String(grantedCount))}</span>}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{copy.tools.description}</p>

      {error && !data ? (
        <AiState error={error} copy={copy} onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <LoadingRows rows={4} label={copy.tools.loading} />
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {data.catalog.map((tool) => {
            const permission = data.permissions.find((p) => p.toolKey === tool.toolKey)
            const granted = permission?.granted ?? false
            const accessMode = permission?.accessMode ?? tool.defaultAccessMode
            return (
              <li key={tool.toolKey} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">{tool.label}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill tone="muted" label={domainLabel(copy, tool.domain)} />
                    <StatusPill tone="neutral" label={copy.tools[accessMode]} />
                    {tool.alwaysDeny ? (
                      <StatusPill tone="danger" label={copy.tools.restricted} />
                    ) : granted ? (
                      <StatusPill tone="success" label={copy.tools.granted} />
                    ) : (
                      <StatusPill tone="muted" label={copy.tools.denied} />
                    )}
                  </div>
                  {tool.alwaysDeny && <p className="text-xs text-muted-foreground">{copy.tools.restrictedHelp}</p>}
                  {granted && !executionLive && <p className="text-xs text-muted-foreground">{copy.tools.notExecutable}</p>}
                </div>
                {tool.alwaysDeny ? (
                  <Lock className="size-4 shrink-0 text-muted-foreground" aria-label={copy.tools.restricted} />
                ) : (
                  <Button
                    size="sm"
                    variant={granted ? 'outline' : 'secondary'}
                    disabled={readOnly || pending !== null}
                    aria-pressed={granted}
                    onClick={() => toggle(tool.toolKey, accessMode, !granted)}
                  >
                    {pending === tool.toolKey ? copy.common.saving : granted ? copy.tools.revoke : copy.tools.grant}
                    <span className="sr-only">: {tool.label}</span>
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {failure && <AiState compact code={failure.code} detail={failure.detail} copy={copy} />}
    </section>
  )
}
