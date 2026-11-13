import { createHash } from 'node:crypto'
import { workforceDefaultBudgetPeriodKey } from '@/config/workforce'
import { denyBillingGroupSiblingCustomerAiAccess } from '@/lib/platform/customer-ai-workforce/account-isolation'
import { detectCustomerAiPromptInjection } from '@/lib/platform/customer-ai-workforce/pilot-prep-gates'
import { isPilotReceptionistAllowedKnowledgeClassification } from '@/lib/platform/customer-ai-workforce/pilot-knowledge-scope'
import { assertPositiveIntegerSubunits } from '@/lib/platform/workforce/amount-validation'
import { isInternalAgentIdentity } from '@/lib/platform/workforce/operator-auth'
import {
  AI_WORKFORCE_ACCOUNT_HARD_CEILING_SUBUNITS,
  AI_WORKFORCE_ACCOUNT_SOFT_CEILING_SUBUNITS,
  AI_WORKFORCE_DRAFT_COST_SUBUNITS,
  AI_WORKFORCE_READ_COST_SUBUNITS,
} from '@/lib/platform/ai-workforce-execution/constants'
import {
  idempotencyScope,
  type AiWorkforceOrchestrationStore,
} from '@/lib/platform/ai-workforce-execution/store'
import {
  issueAccountWorkforcePreparationApproval,
  verifyAccountWorkforcePreparationApproval,
} from '@/lib/platform/ai-workforce-execution/approval-records'
import { resolveServerChannelCoverageState } from '@/lib/platform/ai-workforce-execution/coverage-resolver'
import { resolveServerAuthorizedSourceRecordIds } from '@/lib/platform/ai-workforce-execution/source-records-resolver'
import { composeToolDraft, resolveComposedTool } from '@/lib/platform/ai-workforce-execution/tool-bindings'
import type {
  AiWorkforceLocale,
  AiWorkforcePreparation,
  AiWorkforceResult,
  BindHumanApprovedActionInput,
  PrepareAccountWorkforceActionInput,
} from '@/lib/platform/ai-workforce-execution/types'
import { describeWorkflowHandoff } from '@/lib/platform/ai-workforce-execution/workflow-visibility'

function fail(code: string, message: string): AiWorkforceResult<never> {
  return { ok: false, code, message }
}

function periodUsage(store: AiWorkforceOrchestrationStore, customerAccountId: string, periodKey: string): number {
  let total = 0
  for (const row of store.budget.values()) {
    if (row.customerAccountId === customerAccountId && row.periodKey === periodKey) {
      total += row.amountSubunits
    }
  }
  return total
}

function requestFingerprint(input: PrepareAccountWorkforceActionInput, locale: AiWorkforceLocale): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        customerAccountId: input.customerAccountId,
        toolKey: input.toolKey,
        locale,
        managedSiteId: input.managedSiteId ?? null,
        sourceRecordIds: [...(input.sourceRecordIds ?? [])].sort(),
        serverClassification: input.serverClassification ?? 'GENERAL_BUSINESS',
      }),
    )
    .digest('hex')
}

function actionHash(preparation: {
  customerAccountId: string
  managedSiteId: string | null
  toolKey: string
  locale: AiWorkforceLocale
  draft: Record<string, unknown>
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        customerAccountId: preparation.customerAccountId,
        managedSiteId: preparation.managedSiteId,
        toolKey: preparation.toolKey,
        locale: preparation.locale,
        draft: preparation.draft,
      }),
    )
    .digest('hex')
}

function resolveLocale(locale: string | undefined): AiWorkforceResult<AiWorkforceLocale> {
  const value = locale ?? 'en'
  if (value === 'en' || value === 'es') return { ok: true, value }
  return fail('VALIDATION', 'Locale must be en or es')
}

export function pauseAccountWorkforce(
  store: AiWorkforceOrchestrationStore,
  input: { customerAccountId: string; operatorUserId: string; operatorIsStaff: boolean; reason?: string },
): AiWorkforceResult<{ paused: true }> {
  if (isInternalAgentIdentity(input.operatorUserId)) {
    return fail('AGENT_IMPERSONATION_DENIED', 'Agents cannot pause account workforce execution')
  }
  if (!input.operatorIsStaff) {
    return fail('FORBIDDEN', 'Staff operator role required to pause account workforce preparation')
  }
  store.pauses.set(input.customerAccountId, {
    customerAccountId: input.customerAccountId,
    active: true,
    reason: input.reason,
    setByUserId: input.operatorUserId,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true, value: { paused: true } }
}

export function resumeAccountWorkforce(
  store: AiWorkforceOrchestrationStore,
  input: { customerAccountId: string; operatorUserId: string; operatorIsStaff: boolean },
): AiWorkforceResult<{ paused: false }> {
  if (isInternalAgentIdentity(input.operatorUserId)) {
    return fail('AGENT_IMPERSONATION_DENIED', 'Agents cannot resume account workforce execution')
  }
  if (!input.operatorIsStaff) {
    return fail('FORBIDDEN', 'Staff operator role required to resume account workforce preparation')
  }
  const existing = store.pauses.get(input.customerAccountId)
  if (!existing?.active) return fail('NOT_FOUND', 'Active account pause not found')
  store.pauses.set(input.customerAccountId, {
    ...existing,
    active: false,
    setByUserId: input.operatorUserId,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true, value: { paused: false } }
}

export function isAccountWorkforcePaused(
  store: AiWorkforceOrchestrationStore,
  customerAccountId: string,
): boolean {
  return store.pauses.get(customerAccountId)?.active === true
}

export function prepareAccountWorkforceAction(
  store: AiWorkforceOrchestrationStore,
  input: PrepareAccountWorkforceActionInput,
): AiWorkforceResult<AiWorkforcePreparation> {
  if (!input.customerAccountId || !input.actorUserId || !input.toolKey || !input.idempotencyKey) {
    return fail('VALIDATION', 'Account, actor, tool, and idempotency key are required')
  }
  if (input.liveExecutionRequested) {
    return fail('EXECUTION_DISABLED', 'Live AI execution remains disabled')
  }
  if (input.untrustedPrompt) {
    const injection = detectCustomerAiPromptInjection(input.untrustedPrompt)
    if (injection) return fail('POLICY_BLOCKED', injection)
  }

  const operatingAccountId = input.operatingAccountId ?? input.customerAccountId
  if (operatingAccountId !== input.customerAccountId) {
    return fail('TENANT_MISMATCH', 'Operating account must match the workforce account')
  }
  if (input.targetAccountId && input.targetAccountId !== input.customerAccountId) {
    const sibling = denyBillingGroupSiblingCustomerAiAccess({
      actorUserId: input.actorUserId,
      operatingAccountId: input.customerAccountId,
      recordAccountId: input.targetAccountId,
      operatingMemberships: input.operatingMemberships ?? [],
      billingGroupSiblingAccounts: input.billingGroupSiblingAccounts ?? new Map(),
    })
    if (!sibling.ok) return fail(sibling.error, sibling.message ?? 'Sibling account access denied')
  }

  const classification = input.serverClassification ?? 'GENERAL_BUSINESS'
  if (classification === 'PHI' || classification === 'REGULATED_HEALTHCARE') {
    return fail('POLICY_BLOCKED', 'Regulated data is outside the AI workforce preparation boundary')
  }

  const locale = resolveLocale(input.locale)
  if (!locale.ok) return locale

  const binding = resolveComposedTool(input.toolKey)
  if (binding.effect === 'DENIED') {
    return fail(binding.denialReason ?? 'POLICY_BLOCKED', 'Tool is not available for preparation')
  }
  if (binding.domain === 'knowledge' && !isPilotReceptionistAllowedKnowledgeClassification(classification)) {
    return fail('POLICY_BLOCKED', 'Knowledge retrieval is limited to approved business classifications')
  }

  const fingerprint = requestFingerprint(input, locale.value)
  const scope = idempotencyScope(input.customerAccountId, input.idempotencyKey)
  const existingId = store.byIdempotency.get(scope)
  if (existingId) {
    const existing = store.preparations.get(existingId)
    if (!existing) return fail('FAILED', 'Idempotency pointer missing')
    if (existing.requestFingerprint !== fingerprint) {
      return fail('IDEMPOTENCY_CONFLICT', 'Idempotency key reused with a different request')
    }
    return { ok: true, value: { ...existing, replayed: true } }
  }

  if (isAccountWorkforcePaused(store, input.customerAccountId)) {
    return fail('PAUSED', 'Account workforce preparation is paused')
  }

  const amount = binding.effect === 'DRAFT' ? AI_WORKFORCE_DRAFT_COST_SUBUNITS : AI_WORKFORCE_READ_COST_SUBUNITS
  const amountCheck = assertPositiveIntegerSubunits(amount, 'estimatedInternalSubunits')
  if (!amountCheck.ok) return fail(amountCheck.code, amountCheck.message)

  const hardCeiling = input.costCeilingSubunits ?? AI_WORKFORCE_ACCOUNT_HARD_CEILING_SUBUNITS
  const softCeiling = input.softCeilingSubunits ?? AI_WORKFORCE_ACCOUNT_SOFT_CEILING_SUBUNITS
  const hardCheck = assertPositiveIntegerSubunits(hardCeiling, 'costCeilingSubunits')
  if (!hardCheck.ok) return fail(hardCheck.code, hardCheck.message)
  const periodKey = workforceDefaultBudgetPeriodKey()
  const used = periodUsage(store, input.customerAccountId, periodKey)
  if (used + amount > hardCeiling) {
    return fail('BUDGET_EXCEEDED', 'Account AI preparation ceiling exceeded. Customer charge remains 0.')
  }

  const serverChannelCoverage = resolveServerChannelCoverageState({
    customerAccountId: input.customerAccountId,
    toolKey: input.toolKey,
  })
  const serverVerifiedSourceRecordIds = resolveServerAuthorizedSourceRecordIds({
    customerAccountId: input.customerAccountId,
    toolKey: input.toolKey,
    candidateRecordIds: input.sourceRecordIds ?? [],
  })
  const composed = composeToolDraft(input.toolKey, {
    ...input,
    locale: locale.value,
    serverChannelCoverage,
    serverVerifiedSourceRecordIds,
  })
  if (!composed) return fail('FAILED', 'Tool composer missing')

  let coverageState = composed.coverageState
  if (used + amount > softCeiling) coverageState = 'SOFT_CEILING'

  const draft = composed.draft
  const hash = actionHash({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId ?? null,
    toolKey: input.toolKey,
    locale: locale.value,
    draft,
  })
  const preparation: AiWorkforcePreparation = {
    id: store.nextId(),
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId ?? null,
    actorUserId: input.actorUserId,
    toolKey: input.toolKey,
    domain: binding.domain,
    locale: locale.value,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: fingerprint,
    actionHash: hash,
    status: binding.effect === 'DRAFT' ? 'PENDING_APPROVAL' : 'PREPARED',
    executionState: 'DISABLED',
    coverageState,
    customerChargeUsd: 0,
    estimatedInternalSubunits: amount,
    outbound: 'BLOCKED',
    moneyEffect: 'NONE',
    liveInference: 'DISABLED',
    persistence: 'IN_MEMORY_PREPARATION',
    externalEffectCount: 0,
    workflow: describeWorkflowHandoff({ idempotencyKey: input.idempotencyKey, actionHash: hash }),
    draft,
    approvalId: null,
    approverUserId: null,
    replayed: false,
    createdAt: new Date().toISOString(),
  }
  store.preparations.set(preparation.id, preparation)
  store.byIdempotency.set(scope, preparation.id)
  store.budget.set(scope, {
    idempotencyKey: input.idempotencyKey,
    customerAccountId: input.customerAccountId,
    amountSubunits: amount,
    periodKey,
  })
  return { ok: true, value: preparation }
}

export { issueAccountWorkforcePreparationApproval, verifyAccountWorkforcePreparationApproval }

export function bindHumanApprovedAction(
  store: AiWorkforceOrchestrationStore,
  input: BindHumanApprovedActionInput,
): AiWorkforceResult<AiWorkforcePreparation> {
  if (isInternalAgentIdentity(input.approverUserId)) {
    return fail('AGENT_IMPERSONATION_DENIED', 'Agents cannot approve workforce actions')
  }
  if (!input.approverIsStaff) {
    return fail('FORBIDDEN', 'Staff operator role required to bind workforce approvals')
  }
  if (!input.approvalId || !input.actionHash) {
    return fail('APPROVAL_REQUIRED', 'Server approval id and action hash are required')
  }
  const current = store.preparations.get(input.preparationId)
  if (!current || current.customerAccountId !== input.customerAccountId) {
    return fail('NOT_FOUND', 'Preparation not found for this account')
  }
  if (current.actionHash !== input.actionHash) {
    return fail('ACTION_HASH_MISMATCH', 'Approval hash does not match the prepared action')
  }
  if (current.status === 'PREPARED') {
    return fail('NOT_CONSEQUENTIAL', 'Read preparations do not accept an approval binding')
  }
  if (current.status === 'APPROVED_EFFECT_BLOCKED' || current.status === 'REJECTED') {
    if (current.approvalId === input.approvalId && current.status !== 'REJECTED') {
      return { ok: true, value: { ...current, replayed: true, externalEffectCount: 0 } }
    }
    if (current.approvalId === input.approvalId && current.status === 'REJECTED' && input.decision === 'REJECTED') {
      return { ok: true, value: { ...current, replayed: true, externalEffectCount: 0 } }
    }
    return fail('APPROVAL_ALREADY_BOUND', 'Preparation already has a human decision')
  }
  if (isAccountWorkforcePaused(store, input.customerAccountId)) {
    return fail('PAUSED', 'Paused accounts cannot bind new workforce actions')
  }

  const verified = verifyAccountWorkforcePreparationApproval(store, {
    approvalId: input.approvalId,
    customerAccountId: input.customerAccountId,
    preparationId: input.preparationId,
    actionHash: input.actionHash,
    decision: input.decision,
    consume: true,
  })
  if (!verified.ok) return verified

  const updated: AiWorkforcePreparation = {
    ...current,
    status: input.decision === 'APPROVED' ? 'APPROVED_EFFECT_BLOCKED' : 'REJECTED',
    approvalId: input.approvalId,
    approverUserId: input.approverUserId,
    executionState: 'DISABLED',
    outbound: 'BLOCKED',
    moneyEffect: 'NONE',
    liveInference: 'DISABLED',
    externalEffectCount: 0,
    workflow: describeWorkflowHandoff({
      idempotencyKey: current.idempotencyKey,
      actionHash: current.actionHash,
    }),
    replayed: false,
  }
  store.preparations.set(updated.id, updated)
  return { ok: true, value: updated }
}
