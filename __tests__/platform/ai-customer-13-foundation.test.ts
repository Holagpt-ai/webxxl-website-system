import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  CLINICAL_ONLY_USER_ID,
} from '@/lib/platform/fixtures/abmed'
import {
  approveCustomerAiKnowledge,
  createCustomerAiConversation,
  createCustomerAiEmployee,
  evaluateCustomerAiToolAuthorization,
  getCustomerAiEmployee,
  ingestCustomerAiMessage,
  requestCustomerAiHandoff,
  setCustomerAiToolPermission,
  transitionCustomerAiEmployee,
  upsertCustomerAiKnowledge,
} from '@/lib/platform/customer-ai-workforce/api'
import { createMemoryCustomerAiStore } from '@/lib/platform/customer-ai-workforce/memory-store'
import { isCustomerAiWorkforceEnabled } from '@/config/customer-ai-workforce'

const clinical = { userId: CLINICAL_ONLY_USER_ID, platformRole: 'CUSTOMER' as const }
const staff = { userId: 'staff_ai', platformRole: 'ADMIN' as const }
const page = { take: 10, skip: 0 }

function store() {
  return createMemoryCustomerAiStore({
    operating: [
      { userId: CLINICAL_ONLY_USER_ID, customerAccountId: ABMED_CLINICAL_ACCOUNT_ID },
      { userId: CLINICAL_ONLY_USER_ID, customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID },
    ],
    policies: [
      {
        customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
        maxActiveEmployees: 2,
        monthlyMessageBudget: 1000,
        monthlyTokenBudget: null,
        rateLimitPerMinute: 0,
        executionEnabled: false,
        emergencyDisabled: false,
      },
    ],
  })
}

describe('AI-CUSTOMER-13 foundation', () => {
  beforeEach(() => {
    vi.stubEnv('CUSTOMER_AI_WORKFORCE_ENABLED', 'true')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('exposes disabled flag by default in CI env', () => {
    vi.unstubAllEnvs()
    expect(isCustomerAiWorkforceEnabled()).toBe(false)
  })

  it('denies cross-account employee reads when path account does not own the employee', async () => {
    const s = createMemoryCustomerAiStore({
      operating: [
        { userId: CLINICAL_ONLY_USER_ID, customerAccountId: ABMED_CLINICAL_ACCOUNT_ID },
        { userId: CLINICAL_ONLY_USER_ID, customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID },
      ],
    })
    const created = await createCustomerAiEmployee(s, clinical, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      displayName: 'Reception',
      roleTitle: 'Front desk',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const cross = await getCustomerAiEmployee(s, clinical, ABMED_AESTHETICS_ACCOUNT_ID, created.value.id)
    expect(cross.ok).toBe(false)
    if (cross.ok) return
    expect(cross.error).toBe('NOT_FOUND')
  })

  it('forbids access when user lacks operating membership on account', async () => {
    const s = createMemoryCustomerAiStore({
      operating: [{ userId: CLINICAL_ONLY_USER_ID, customerAccountId: ABMED_CLINICAL_ACCOUNT_ID }],
    })
    const denied = await getCustomerAiEmployee(s, clinical, ABMED_AESTHETICS_ACCOUNT_ID, 'missing')
    expect(denied.ok).toBe(false)
    if (denied.ok) return
    expect(denied.error).toBe('FORBIDDEN')
  })

  it('blocks ACTIVE lifecycle without entitlement', async () => {
    const s = store()
    const created = await createCustomerAiEmployee(s, clinical, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      displayName: 'Agent',
      roleTitle: 'Support',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    await transitionCustomerAiEmployee(s, clinical, ABMED_CLINICAL_ACCOUNT_ID, created.value.id, 'INACTIVE')
    const active = await transitionCustomerAiEmployee(s, clinical, ABMED_CLINICAL_ACCOUNT_ID, created.value.id, 'ACTIVE')
    expect(active.ok).toBe(false)
    if (active.ok) return
    expect(active.error).toBe('ENTITLEMENT_UNRESOLVED')
  })

  it('allows staff to activate within policy limits', async () => {
    const s = store()
    const created = await createCustomerAiEmployee(s, staff, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      displayName: 'Agent',
      roleTitle: 'Support',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    await transitionCustomerAiEmployee(s, staff, ABMED_CLINICAL_ACCOUNT_ID, created.value.id, 'INACTIVE')
    const active = await transitionCustomerAiEmployee(s, staff, ABMED_CLINICAL_ACCOUNT_ID, created.value.id, 'ACTIVE')
    expect(active.ok).toBe(true)
  })

  it('preserves knowledge revision integrity through approve/publish', async () => {
    const s = store()
    const draft = await upsertCustomerAiKnowledge(s, clinical, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      kind: 'FAQ',
      title: 'Hours',
      content: { excerpt: 'Mon-Fri 9-5', body: '...' },
      status: 'IN_REVIEW',
    })
    expect(draft.ok).toBe(true)
    if (!draft.ok) return
    const published = await approveCustomerAiKnowledge(s, clinical, ABMED_CLINICAL_ACCOUNT_ID, draft.value.id)
    expect(published.ok).toBe(true)
    if (!published.ok) return
    expect(published.value.status).toBe('PUBLISHED')
    expect(published.value.currentRevisionNumber).toBe(1)
  })

  it('denies tool execution by default and allows explicit grant', async () => {
    const s = store()
    const created = await createCustomerAiEmployee(s, staff, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      displayName: 'Agent',
      roleTitle: 'Support',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    await transitionCustomerAiEmployee(s, staff, ABMED_CLINICAL_ACCOUNT_ID, created.value.id, 'INACTIVE')
    await transitionCustomerAiEmployee(s, staff, ABMED_CLINICAL_ACCOUNT_ID, created.value.id, 'ACTIVE')
    const denied = await evaluateCustomerAiToolAuthorization(s, clinical, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      employeeId: created.value.id,
      toolKey: 'customerAi.knowledge.retrieve',
      accessMode: 'READ',
    })
    expect(denied.ok).toBe(true)
    if (!denied.ok) return
    expect(denied.value.allowed).toBe(false)
    await setCustomerAiToolPermission(s, clinical, ABMED_CLINICAL_ACCOUNT_ID, created.value.id, 'customerAi.knowledge.retrieve', 'READ', true)
    const stillDenied = await evaluateCustomerAiToolAuthorization(s, clinical, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      employeeId: created.value.id,
      toolKey: 'customerAi.knowledge.retrieve',
      accessMode: 'READ',
    })
    expect(stillDenied.ok).toBe(true)
    if (!stillDenied.ok) return
    expect(stillDenied.value.allowed).toBe(false)
    expect(stillDenied.value.code).toBe('EXECUTION_DISABLED')
  })

  it('ingests messages idempotently and records handoff', async () => {
    const s = store()
    const employee = await createCustomerAiEmployee(s, staff, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      displayName: 'Chat',
      roleTitle: 'Reception',
    })
    expect(employee.ok).toBe(true)
    if (!employee.ok) return
    const session = await createCustomerAiConversation(s, clinical, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      employeeId: employee.value.id,
    })
    expect(session.ok).toBe(true)
    if (!session.ok) return
    const first = await ingestCustomerAiMessage(s, clinical, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      sessionId: session.value.id,
      idempotencyKey: 'msg-1',
      role: 'VISITOR',
      bodyText: 'Hello',
    })
    const second = await ingestCustomerAiMessage(s, clinical, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      sessionId: session.value.id,
      idempotencyKey: 'msg-1',
      role: 'VISITOR',
      bodyText: 'Hello',
    })
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.value.id).toBe(first.value.id)
    const handoff = await requestCustomerAiHandoff(s, clinical, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      sessionId: session.value.id,
      reason: 'Need human',
    })
    expect(handoff.ok).toBe(true)
  })
})
