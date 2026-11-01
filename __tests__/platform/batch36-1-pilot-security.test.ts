import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCustomerAiEmployee,
  setCustomerAiToolPermission,
  transitionCustomerAiEmployee,
  upsertCustomerAiKnowledge,
  approveCustomerAiKnowledge,
} from '@/lib/platform/customer-ai-workforce/api'
import { createMemoryCustomerAiStore } from '@/lib/platform/customer-ai-workforce/memory-store'
import {
  issueCustomerAiPilotApprovalApi,
  prepareCustomerAiPilotTaskApi,
} from '@/lib/platform/customer-ai-workforce/pilot-api'
import { resetCustomerAiPilotTaskStoreForTests, updatePilotApproval } from '@/lib/platform/customer-ai-workforce/pilot-task-store'
import { isCustomerAiPilotHttpEnabled } from '@/config/customer-ai-workforce'

const staff = { userId: 'staff_sec', platformRole: 'ADMIN' as const }
const customerMember = { userId: 'cust_sec', platformRole: 'CUSTOMER' as const }

function policy(acct: string) {
  return {
    customerAccountId: acct,
    maxActiveEmployees: 5,
    monthlyMessageBudget: 100,
    monthlyTokenBudget: 500,
    rateLimitPerMinute: 100,
    executionEnabled: false,
    emergencyDisabled: false,
  }
}

async function activeEmployee(s: ReturnType<typeof createMemoryCustomerAiStore>, acct: string, site: string | null = null) {
  const created = await createCustomerAiEmployee(s, staff, {
    customerAccountId: acct,
    displayName: 'Agent',
    roleTitle: 'Pilot',
    managedSiteId: site,
  })
  if (!created.ok) throw new Error('employee')
  await transitionCustomerAiEmployee(s, staff, acct, created.value.id, 'INACTIVE')
  await transitionCustomerAiEmployee(s, staff, acct, created.value.id, 'ACTIVE')
  for (const [toolKey, mode] of [
    ['customerAi.knowledge.retrieve', 'READ'],
    ['customerAi.workflow.request', 'WRITE'],
    ['customerAi.crm.contacts.read', 'READ'],
    ['customerAi.crm.leads.qualify', 'WRITE'],
  ] as const) {
    await setCustomerAiToolPermission(s, staff, acct, created.value.id, toolKey, mode, true)
  }
  return created.value
}

describe('Batch 36.1 — pilot security regressions', () => {
  beforeEach(() => {
    vi.stubEnv('CUSTOMER_AI_WORKFORCE_ENABLED', 'true')
    vi.stubEnv('CUSTOMER_AI_PILOT_PREP_ENABLED', 'true')
    vi.stubEnv('CUSTOMER_AI_PILOT_TEST_SYNTHETIC', 'true')
    vi.stubEnv('CUSTOMER_AI_PILOT_HTTP_ENABLED', 'false')
    resetCustomerAiPilotTaskStoreForTests()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    resetCustomerAiPilotTaskStoreForTests()
  })

  it('excludes site-restricted knowledge without verifiable site ownership', async () => {
    const acct = 'acct_site_restricted'
    const s = createMemoryCustomerAiStore({
      operating: [{ userId: staff.userId, customerAccountId: acct }],
      policies: [policy(acct)],
    })
    const emp = await activeEmployee(s, acct, 'site_1')
    const restricted = await upsertCustomerAiKnowledge(s, staff, {
      customerAccountId: acct,
      kind: 'FAQ',
      title: 'Site only FAQ',
      languageTag: 'en',
      classification: 'SITE_RESTRICTED',
      content: { excerpt: 'hidden' },
      status: 'IN_REVIEW',
    })
    if (restricted.ok) await approveCustomerAiKnowledge(s, staff, acct, restricted.value.id)

    const prep = await prepareCustomerAiPilotTaskApi(s, staff, {
      customerAccountId: acct,
      employeeId: emp.id,
      managedSiteId: 'site_1',
      workflowKind: 'receptionist_preparation',
      idempotencyKey: 'site-rest',
      prepareConsequentialDraft: false,
      context: { locale: 'en', managedSiteId: 'site_1', trustedDataSource: 'SERVER' },
    })
    expect(prep.ok).toBe(true)
    if (!prep.ok) return
    expect(prep.value.outcome).toBe('UNVERIFIED')
    expect(JSON.stringify(prep.value.draftPayload)).not.toContain('Site only FAQ')
  })

  it('never returns PHI, regulated healthcare, or unknown classifications in receptionist prep', async () => {
    const acct = 'acct_class_denied'
    const s = createMemoryCustomerAiStore({
      operating: [{ userId: staff.userId, customerAccountId: acct }],
      policies: [policy(acct)],
    })
    const emp = await activeEmployee(s, acct)
    const safeTitle = 'Safe business hours'
    const forbidden = [
      { title: 'PHI record leak', classification: 'PHI' },
      { title: 'Clinical trial data', classification: 'REGULATED_HEALTHCARE' },
      { title: 'Mystery bucket', classification: 'UNKNOWN_SENSITIVE_BUCKET' },
    ] as const
    for (const row of forbidden) {
      const draft = await upsertCustomerAiKnowledge(s, staff, {
        customerAccountId: acct,
        kind: 'FAQ',
        title: row.title,
        languageTag: 'en',
        classification: row.classification,
        content: { excerpt: row.title },
        status: 'IN_REVIEW',
      })
      if (draft.ok) await approveCustomerAiKnowledge(s, staff, acct, draft.value.id)
    }
    const safe = await upsertCustomerAiKnowledge(s, staff, {
      customerAccountId: acct,
      kind: 'FAQ',
      title: safeTitle,
      languageTag: 'en',
      classification: 'GENERAL_BUSINESS',
      content: { excerpt: 'Mon-Fri 9-5' },
      status: 'IN_REVIEW',
    })
    if (safe.ok) await approveCustomerAiKnowledge(s, staff, acct, safe.value.id)

    const prep = await prepareCustomerAiPilotTaskApi(s, staff, {
      customerAccountId: acct,
      employeeId: emp.id,
      managedSiteId: null,
      workflowKind: 'receptionist_preparation',
      idempotencyKey: 'class-deny',
      prepareConsequentialDraft: false,
      context: { locale: 'en', managedSiteId: null, trustedDataSource: 'SERVER' },
    })
    expect(prep.ok).toBe(true)
    if (!prep.ok) return
    expect(prep.value.outcome).toBe('PREPARED')
    const payload = JSON.stringify(prep.value.draftPayload)
    expect(payload).toContain(safeTitle)
    for (const row of forbidden) {
      expect(payload).not.toContain(row.title)
    }

    const onlyForbidden = createMemoryCustomerAiStore({
      operating: [{ userId: staff.userId, customerAccountId: 'acct_only_bad' }],
      policies: [policy('acct_only_bad')],
    })
    const emp2 = await activeEmployee(onlyForbidden, 'acct_only_bad')
    for (const row of forbidden) {
      const draft = await upsertCustomerAiKnowledge(onlyForbidden, staff, {
        customerAccountId: 'acct_only_bad',
        kind: 'FAQ',
        title: row.title,
        languageTag: 'en',
        classification: row.classification,
        content: { excerpt: row.title },
        status: 'IN_REVIEW',
      })
      if (draft.ok) await approveCustomerAiKnowledge(onlyForbidden, staff, 'acct_only_bad', draft.value.id)
    }
    const unverified = await prepareCustomerAiPilotTaskApi(onlyForbidden, staff, {
      customerAccountId: 'acct_only_bad',
      employeeId: emp2.id,
      managedSiteId: null,
      workflowKind: 'receptionist_preparation',
      idempotencyKey: 'class-unverified',
      prepareConsequentialDraft: false,
      context: { locale: 'en', managedSiteId: null, trustedDataSource: 'SERVER' },
    })
    expect(unverified.ok).toBe(true)
    if (!unverified.ok) return
    expect(unverified.value.outcome).toBe('UNVERIFIED')
  })

  it('returns UNVERIFIED for SERVER CRM prep without authoritative retrieval', async () => {
    const acct = 'acct_server_crm'
    const s = createMemoryCustomerAiStore({
      operating: [{ userId: staff.userId, customerAccountId: acct }],
      policies: [policy(acct)],
    })
    const emp = await activeEmployee(s, acct)
    const prep = await prepareCustomerAiPilotTaskApi(s, staff, {
      customerAccountId: acct,
      employeeId: emp.id,
      managedSiteId: null,
      workflowKind: 'crm_lead_intelligence',
      idempotencyKey: 'srv-crm',
      prepareConsequentialDraft: false,
      context: { locale: 'en', managedSiteId: null, trustedDataSource: 'SERVER' },
    })
    expect(prep.ok).toBe(true)
    if (!prep.ok) return
    expect(prep.value.outcome).toBe('UNVERIFIED')
    expect(prep.value.draftPayload.authoritativeFindingsBlocked).toBe(true)
  })

  it('denies customer membership from issuing pilot approvals', async () => {
    const acct = 'acct_approver'
    const s = createMemoryCustomerAiStore({
      operating: [
        { userId: staff.userId, customerAccountId: acct },
        { userId: customerMember.userId, customerAccountId: acct },
      ],
      policies: [policy(acct)],
    })
    const emp = await activeEmployee(s, acct)
    const prep = await prepareCustomerAiPilotTaskApi(s, staff, {
      customerAccountId: acct,
      employeeId: emp.id,
      managedSiteId: null,
      workflowKind: 'marketing_seo_assistant',
      idempotencyKey: 'appr-1',
      prepareConsequentialDraft: true,
      context: { locale: 'en', managedSiteId: null, trustedDataSource: 'SERVER' },
    })
    expect(prep.ok).toBe(true)
    if (!prep.ok) return
    const denied = await issueCustomerAiPilotApprovalApi(s, customerMember, {
      preparedTaskId: prep.value.taskId,
      customerAccountId: acct,
      allowedAction: 'execute_prepared_draft',
      destinationRef: null,
      maxCostUnits: 50,
      ttlSeconds: 3600,
    })
    expect(denied.ok).toBe(false)
    if (denied.ok) return
    expect(denied.error).toBe('FORBIDDEN')

    const allowed = await issueCustomerAiPilotApprovalApi(s, staff, {
      preparedTaskId: prep.value.taskId,
      customerAccountId: acct,
      allowedAction: 'execute_prepared_draft',
      destinationRef: null,
      maxCostUnits: 50,
      ttlSeconds: 3600,
    })
    expect(allowed.ok).toBe(true)
  })

  it('conflicts idempotency replay when request fingerprint changes', async () => {
    const acct = 'acct_fingerprint'
    const s = createMemoryCustomerAiStore({
      operating: [{ userId: staff.userId, customerAccountId: acct }],
      policies: [policy(acct)],
    })
    const emp = await activeEmployee(s, acct)
    const base = {
      customerAccountId: acct,
      employeeId: emp.id,
      managedSiteId: null,
      workflowKind: 'crm_lead_intelligence' as const,
      idempotencyKey: 'fp-1',
      prepareConsequentialDraft: false,
    }
    const first = await prepareCustomerAiPilotTaskApi(s, staff, {
      ...base,
      context: {
        locale: 'en',
        managedSiteId: null,
        trustedDataSource: 'TEST_SYNTHETIC',
        testSyntheticSnapshot: { leads: [{ id: 'a', needsFollowUp: false }] },
      },
    })
    expect(first.ok).toBe(true)
    const second = await prepareCustomerAiPilotTaskApi(s, staff, {
      ...base,
      context: {
        locale: 'en',
        managedSiteId: null,
        trustedDataSource: 'TEST_SYNTHETIC',
        testSyntheticSnapshot: { leads: [{ id: 'b', needsFollowUp: true }] },
      },
    })
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.error).toBe('VALIDATION')
  })

  it('blocks idempotent replay after emergency pause', async () => {
    const acct = 'acct_replay_pause'
    const s = createMemoryCustomerAiStore({
      operating: [{ userId: staff.userId, customerAccountId: acct }],
      policies: [policy(acct)],
    })
    const emp = await activeEmployee(s, acct)
    const input = {
      customerAccountId: acct,
      employeeId: emp.id,
      managedSiteId: null,
      workflowKind: 'marketing_seo_assistant' as const,
      idempotencyKey: 'replay-pause',
      prepareConsequentialDraft: false,
      context: { locale: 'en', managedSiteId: null, trustedDataSource: 'SERVER' as const },
    }
    const first = await prepareCustomerAiPilotTaskApi(s, staff, input)
    expect(first.ok).toBe(true)
    const row = await s.findEmployeeById(emp.id)
    if (row) await s.updateEmployee(emp.id, { ...row, emergencyPaused: true })
    const replay = await prepareCustomerAiPilotTaskApi(s, staff, input)
    expect(replay.ok).toBe(false)
    if (replay.ok) return
    expect(replay.error).toBe('EMERGENCY_DISABLED')
  })

  it('keeps pilot HTTP disabled by default even when prep flag is on', () => {
    expect(isCustomerAiPilotHttpEnabled()).toBe(false)
  })

  it('rejects invalid approval TTL at issue time', async () => {
    const acct = 'acct_ttl'
    const s = createMemoryCustomerAiStore({
      operating: [{ userId: staff.userId, customerAccountId: acct }],
      policies: [policy(acct)],
    })
    const emp = await activeEmployee(s, acct)
    const prep = await prepareCustomerAiPilotTaskApi(s, staff, {
      customerAccountId: acct,
      employeeId: emp.id,
      managedSiteId: null,
      workflowKind: 'marketing_seo_assistant',
      idempotencyKey: 'ttl',
      prepareConsequentialDraft: true,
      context: { locale: 'en', managedSiteId: null, trustedDataSource: 'SERVER' },
    })
    expect(prep.ok).toBe(true)
    if (!prep.ok) return
    const badTtl = await issueCustomerAiPilotApprovalApi(s, staff, {
      preparedTaskId: prep.value.taskId,
      customerAccountId: acct,
      allowedAction: 'execute_prepared_draft',
      destinationRef: null,
      maxCostUnits: 50,
      ttlSeconds: 5,
    })
    expect(badTtl.ok).toBe(false)

    const issued = await issueCustomerAiPilotApprovalApi(s, staff, {
      preparedTaskId: prep.value.taskId,
      customerAccountId: acct,
      allowedAction: 'execute_prepared_draft',
      destinationRef: null,
      maxCostUnits: 50,
      ttlSeconds: 3600,
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    updatePilotApproval(issued.value.approvalId, { expiresAt: new Date(Date.now() - 1000) })
  })
})
