'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { aiMutate, useAi } from '@/lib/ai-employees-ui/client'
import {
  PILOT_WORKFLOW_KINDS,
  pilotApprovalUrl,
  pilotPrepareUrl,
  pilotTaskUrl,
  type CustomerAiPilotTaskSummary,
  type CustomerAiPilotWorkflowKind,
} from '@/lib/ai-employees-ui/pilot'
import { fill, formatDate } from '@/lib/commerce-ui/format'
import { newIdempotencyKey } from '@/lib/crm-ui/workspace'
import { Facts, SelectField, StatusPill, UnavailableAction } from '@/components/crm/workspace-kit'
import { LoadingRows, Section } from './ui'
import type { WorkforceContext } from './workforce-view'
import type { AiEmployee } from '@/lib/ai-employees-ui/client'
function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
}

type PrepareResponse = CustomerAiPilotTaskSummary & {
  draftPayload?: Record<string, unknown>
  executionAuthorized?: false
}

export function PilotTasksPanel({ employee, ctx }: { employee: AiEmployee; ctx: WorkforceContext }) {
  const { copy, accountId, locale } = ctx
  const p = copy.pilot
  const [workflowKind, setWorkflowKind] = useState<CustomerAiPilotWorkflowKind>('receptionist_preparation')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [approvalPending, setApprovalPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const taskUrl = taskId ? pilotTaskUrl(accountId, taskId) : null
  const taskRes = useAi<CustomerAiPilotTaskSummary>(taskUrl)

  const prepare = async () => {
    setPending(true)
    setFailure(null)
    const result = await aiMutate<PrepareResponse>(pilotPrepareUrl(accountId, employee.id), 'POST', {
      workflowKind,
      idempotencyKey: newIdempotencyKey(),
      prepareConsequentialDraft: false,
      locale: employee.primaryLocale,
    })
    setPending(false)
    if (!result.ok) {
      setFailure(result.detail ?? result.code)
      return
    }
    setTaskId(result.data.taskId)
  }

  const issueApproval = async () => {
    if (!taskId) return
    setApprovalPending(true)
    setFailure(null)
    const result = await aiMutate<{ approvalId?: string }>(pilotApprovalUrl(accountId, taskId), 'POST', {
      allowedAction: 'execute_prepared_draft',
    })
    setApprovalPending(false)
    if (!result.ok) {
      setFailure(result.detail ?? result.code)
      return
    }
    await taskRes.mutate()
  }

  return (
    <Section title={p.title} description={p.description}>
      <UnavailableAction label={p.executionOff} reason={p.executionOffReason} />
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void prepare()
        }}
      >
        <SubHeading>{p.prepareTitle}</SubHeading>
        <SelectField
          label={p.workflow}
          value={workflowKind}
          onChange={(v) => setWorkflowKind(v as CustomerAiPilotWorkflowKind)}
          options={PILOT_WORKFLOW_KINDS.map((kind) => ({ value: kind, label: p.workflows[kind] ?? kind }))}
        />
        <Button type="submit" size="sm" disabled={pending || employee.status === 'ARCHIVED'}>
          {pending ? p.preparing : p.prepare}
        </Button>
        {failure && <p className="text-sm text-destructive">{failure}</p>}
      </form>

      {taskId && (
        <div className="mt-6 flex flex-col gap-4">
          <SubHeading>{p.statusTitle}</SubHeading>
          {taskRes.isLoading && !taskRes.data ? (
            <LoadingRows rows={2} label={copy.common.loading} />
          ) : taskRes.data ? (
            <>
              <Facts
                items={[
                  [copy.common.reference, taskRes.data.publicId],
                  [copy.common.status, <StatusPill key="o" label={taskRes.data.outcome} tone="info" />],
                  [p.workflow, p.workflows[taskRes.data.workflowKind] ?? taskRes.data.workflowKind],
                  [p.sync, taskRes.data.workflowSyncState],
                  [p.approval, taskRes.data.requiresHumanApproval ? p.approvalRequired : p.approvalNotRequired],
                  [p.approvalId, taskRes.data.approvalId ?? copy.common.none],
                  [copy.common.updated, formatDate(new Date().toISOString(), locale)],
                ]}
              />
              {taskRes.data.requiresHumanApproval && !taskRes.data.approvalId && (
                <Button type="button" size="sm" variant="outline" disabled={approvalPending} onClick={() => void issueApproval()}>
                  {approvalPending ? p.issuingApproval : p.issueApproval}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">{fill(p.hashNote, { hash: taskRes.data.actionHash.slice(0, 12) })}</p>
            </>
          ) : null}
        </div>
      )}
    </Section>
  )
}