import { ABMED_GROUP_ID } from '@/lib/platform/fixtures/abmed'
import { PILOT_ACCOUNT_A_ID, PILOT_ACCOUNT_B_ID } from '@/lib/platform/pilot/synthetic-pilot-accounts'

/** Repeatable synthetic pilot steps — executed via Vitest + existing APIs (no outbound side effects). */
export type SyntheticPilotStep = {
  id: string
  title: string
  coverage: 'auth' | 'account' | 'project' | 'crm' | 'leads' | 'funnel' | 'business' | 'isolation'
  automatedTestRefs: string[]
}

export const SYNTHETIC_PILOT_SCENARIO = {
  billingGroupId: ABMED_GROUP_ID,
  accountAId: PILOT_ACCOUNT_A_ID,
  accountBId: PILOT_ACCOUNT_B_ID,
  managedSitesPerAccount: 2,
  description:
    'Two CustomerAccounts under one BillingGroup payer — CRM, leads, and comms data must not cross account boundaries.',
} as const

export const SYNTHETIC_CUSTOMER_PILOT_STEPS: SyntheticPilotStep[] = [
  {
    id: 'auth.en_es',
    title: 'EN/ES portal authentication and locale routes',
    coverage: 'auth',
    automatedTestRefs: ['pilot21a-readiness.test.ts', 'batch30c-lead-funnel-ui-integration.test.ts'],
  },
  {
    id: 'account.project_select',
    title: 'Account and website project selection',
    coverage: 'account',
    automatedTestRefs: ['pilot21a-readiness.test.ts'],
  },
  {
    id: 'project.review_approvals',
    title: 'Website project review and approvals (existing portal)',
    coverage: 'project',
    automatedTestRefs: ['batch31-staging-pilot-readiness.test.ts'],
  },
  {
    id: 'crm.contact_isolation',
    title: 'CRM contact isolation per CustomerAccount',
    coverage: 'crm',
    automatedTestRefs: ['pilot21a-readiness.test.ts', 'batch28a-managed-site-leads.test.ts'],
  },
  {
    id: 'leads.intake_qualify',
    title: 'Synthetic managed-site lead intake, qualification, manual conversion',
    coverage: 'leads',
    automatedTestRefs: ['batch28a-managed-site-leads.test.ts', 'batch28a-1-managed-site-leads-integrity.test.ts'],
  },
  {
    id: 'funnel.reporting',
    title: 'Lead Funnel Reporting (Batch 30A API + 30C UI contract)',
    coverage: 'funnel',
    automatedTestRefs: ['batch30a-lead-funnel-reporting.test.ts', 'batch30c-lead-funnel-ui-integration.test.ts'],
  },
  {
    id: 'business.overview',
    title: 'Business Command Center aggregation with isolated lead source failures',
    coverage: 'business',
    automatedTestRefs: ['batch27a-1-business-overview-integrity.test.ts', 'batch30a-lead-funnel-reporting.test.ts'],
  },
  {
    id: 'isolation.cross_account',
    title: 'Authorization denial across account and BillingGroup sibling boundaries',
    coverage: 'isolation',
    automatedTestRefs: ['pilot21a-readiness.test.ts', 'open001-subscriber-eligibility.test.ts', 'batch31-staging-pilot-readiness.test.ts'],
  },
]

export function summarizeSyntheticPilotWorkflow(): string {
  const lines = [
    `Scenario: ${SYNTHETIC_PILOT_SCENARIO.description}`,
    `BillingGroup: ${SYNTHETIC_PILOT_SCENARIO.billingGroupId}`,
    `Account A: ${SYNTHETIC_PILOT_SCENARIO.accountAId}`,
    `Account B: ${SYNTHETIC_PILOT_SCENARIO.accountBId}`,
    '',
    'Steps:',
  ]
  for (const step of SYNTHETIC_CUSTOMER_PILOT_STEPS) {
    lines.push(`  - [${step.coverage}] ${step.id}: ${step.title}`)
  }
  return lines.join('\n')
}
