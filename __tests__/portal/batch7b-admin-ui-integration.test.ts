import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { adminOperationsEn } from '@/lib/i18n/dictionaries/admin-operations-en'
import { adminOperationsEs } from '@/lib/i18n/dictionaries/admin-operations-es'
import { aiWorkforceExecutionEn } from '@/lib/i18n/dictionaries/ai-workforce-execution-en'
import { aiWorkforceExecutionEs } from '@/lib/i18n/dictionaries/ai-workforce-execution-es'
import { adminOperationsUrl } from '@/lib/admin-ui/operations'
import { AI_EXECUTION_SUMMARY_URL } from '@/lib/ai-employees-ui/execution'

const aiSummaryModule = readFileSync(resolve('lib/ai-employees-ui/execution.ts'), 'utf8')

describe('Batch 7B admin + AI employees UI integration', () => {
  it('admin overview wires staff operations summary API', () => {
    const page = readFileSync(resolve('app/[locale]/admin/page.tsx'), 'utf8')
    expect(page).toContain('requireStaff')
    expect(page).toContain('AdminOperationsSummary')
    expect(page).not.toContain('customerAccountId=')
  })

  it('admin customer drill-down scopes account and tenant-filtered managed sites', () => {
    const page = readFileSync(resolve('app/[locale]/admin/customers/[customerId]/page.tsx'), 'utf8')
    expect(page).toContain('requireStaff')
    expect(page).toContain('customerAccountId={customer.id}')
    expect(page).toContain('prisma.managedSite.findMany')
    expect(page).toMatch(/where:\s*\{\s*customerAccountId:\s*customerId\s*\}/)
    expect(page).toContain('AdminOperationsSummary')
    expect(page).toMatch(/key=\{customer\.id\}/)
  })

  it('AI employees page wires execution summary API', () => {
    const page = readFileSync(resolve('app/[locale]/dashboard/ai-employees/page.tsx'), 'utf8')
    expect(page).toContain('requireCustomerMembership')
    expect(page).toContain('ExecutionReadiness')
    expect(aiSummaryModule).toContain(AI_EXECUTION_SUMMARY_URL)
    expect(aiSummaryModule).toMatch(/customerAccountId:\s*accountId/)
  })

  it('admin operations client builds correct summary URLs', () => {
    expect(adminOperationsUrl()).toBe('/api/v1/admin/operations/summary')
    expect(adminOperationsUrl('acct_a')).toBe('/api/v1/admin/operations/summary?customerAccountId=acct_a')
    expect(adminOperationsUrl('acct_a', 'site_x')).toBe(
      '/api/v1/admin/operations/summary?customerAccountId=acct_a&managedSiteId=site_x',
    )
    const opsClient = readFileSync(resolve('lib/admin-ui/operations.ts'), 'utf8')
    expect(opsClient).toContain('raw.customerAccountId === (customerAccountId ?? null)')
    expect(readFileSync(resolve('components/admin/operations-summary.tsx'), 'utf8')).toContain('SliceUnavailable')
  })

  it('readiness UI avoids fake success copy and shows slice gating', () => {
    const adminOps = readFileSync(resolve('components/admin/operations-summary.tsx'), 'utf8')
    const aiReady = readFileSync(resolve('components/ai-employees/execution-readiness.tsx'), 'utf8')
    expect(adminOps).toContain('liveActivationBlocked')
    expect(adminOps).toContain("slice.status !== 'AVAILABLE'")
    expect(adminOps).toContain('readOnly')
    expect(adminOps).not.toMatch(/connected provider/i)
    expect(aiReady).toContain('executionOff')
    expect(aiReady).toContain('summary.disclosure')
    expect(aiReady).toContain('liveExecutionEnabled')
    expect(aiReady).not.toMatch(/successfully executed/i)
  })

  it('EN and ES dictionary modules expose Batch 7B copy keys', () => {
    expect(adminOperationsEn.title.length).toBeGreaterThan(0)
    expect(adminOperationsEs.title).toBeTruthy()
    expect(adminOperationsEn.errors.UNAUTHORIZED.title).toBeTruthy()
    expect(adminOperationsEs.errors.NOT_FOUND.title).toBeTruthy()
    expect(aiWorkforceExecutionEn.title.length).toBeGreaterThan(0)
    expect(aiWorkforceExecutionEs.executionOff.body).toBeTruthy()
    expect(aiWorkforceExecutionEn.serverDisclosure).toBeTruthy()
  })
})
