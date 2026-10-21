'use client'

import { useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { aiBase, useAi, type AiUsagePolicy } from '@/lib/ai-employees-ui/client'
import type { AiEmployeesCopy } from '@/lib/i18n/dictionaries/ai-employees-en'
import { cn } from '@/lib/utils'
import { AiState, LoadingRows, Notice } from './ui'
import { EmployeesPanel } from './employees-panel'
import { KnowledgePanel } from './knowledge-panel'
import { ConversationsPanel } from './conversations-panel'
import { UsagePanel } from './usage-panel'

const TABS = ['employees', 'knowledge', 'conversations', 'usage'] as const
type Tab = (typeof TABS)[number]

export type WorkforceContext = {
  accountId: string
  accountName: string
  locale: string
  copy: AiEmployeesCopy
  policy: AiUsagePolicy
  refreshPolicy: () => void
}

export function WorkforceView({
  accountId,
  accountName,
  locale,
  copy,
  loginHref,
}: {
  accountId: string
  accountName: string
  locale: string
  copy: AiEmployeesCopy
  loginHref: string
}) {
  const [tab, setTab] = useState<Tab>('employees')
  const { data: policy, error, isLoading, mutate } = useAi<AiUsagePolicy>(`${aiBase(accountId)}/usage-policy`)

  if (error && !policy) return <AiState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
  if (isLoading || !policy) return <LoadingRows rows={4} label={copy.common.loading} />

  const ctx: WorkforceContext = { accountId, accountName, locale, copy, policy, refreshPolicy: () => mutate() }
  const executionLive = policy.flags.executionEnabled && policy.executionEnabled

  return (
    <div className="flex flex-col gap-6">
      {policy.emergencyDisabled ? (
        <Notice tone="danger" icon={ShieldOff} title={copy.execution.emergencyTitle} body={copy.execution.emergencyBody} />
      ) : (
        !executionLive && (
          <Notice
            title={copy.execution.offTitle}
            body={policy.flags.executionEnabled ? copy.execution.accountOffBody : copy.execution.offBody}
          />
        )
      )}

      <div role="tablist" aria-label={copy.tabs.label} className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((key) => (
          <button
            key={key}
            id={`ai-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls={`ai-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              const next = TABS[(TABS.indexOf(key) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
              setTab(next)
              document.getElementById(`ai-tab-${next}`)?.focus()
            }}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50',
              tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {copy.tabs[key]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`ai-panel-${tab}`} aria-labelledby={`ai-tab-${tab}`}>
        {tab === 'employees' && <EmployeesPanel ctx={ctx} />}
        {tab === 'knowledge' && <KnowledgePanel ctx={ctx} />}
        {tab === 'conversations' && <ConversationsPanel ctx={ctx} />}
        {tab === 'usage' && <UsagePanel ctx={ctx} />}
      </div>
    </div>
  )
}
