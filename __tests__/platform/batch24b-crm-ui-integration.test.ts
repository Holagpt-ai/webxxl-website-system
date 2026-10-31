import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CRM_API, type ImportPreview } from '@/lib/crm-ui/types'
import type { CrmImportCommitOutcome } from '@/lib/platform/crm/import-export-service'
import { classifyWorkspaceError } from '@/lib/crm-ui/workspace'
import {
  effectiveMarketingConsentGranted,
  evaluateSegmentGroup,
  validateSegmentFilterGroup,
} from '@/lib/platform/crm/segment-engine'
import { commitCrmImportResponseShape, previewCrmImportResponseShape } from '@/lib/platform/crm/import-api-contract'
import type { SegmentContactView } from '@/lib/platform/crm/segment-engine'

describe('Batch 24B CRM UI integration contracts', () => {
  it('Segment Builder calls POST /api/v1/crm/segments with evaluateOnly', () => {
    const source = readFileSync(join(process.cwd(), 'components/crm/segments.tsx'), 'utf8')
    expect(source).not.toContain('/segments/evaluate')
    expect(source).toContain('evaluateOnly: true')
    expect(source).toContain('CRM_API.segments')
    expect(CRM_API.segments).toBe('/api/v1/crm/segments')
  })

  it('saved segment routes match Batch 23 segment API map', () => {
    expect(CRM_API.segment('seg_1')).toBe('/api/v1/crm/segments/seg_1')
    expect(CRM_API.mergeProposals).toBe('/api/v1/crm/merge-proposals')
    expect(CRM_API.mergeProposal('p1')).toBe('/api/v1/crm/merge-proposals/p1')
  })

  it('supports neq and in filter operators with accurate semantics', () => {
    const contact: SegmentContactView = {
      id: 'c1',
      customerAccountId: 'acct',
      createdAt: new Date('2026-06-01T00:00:00Z'),
      tagLabels: ['vip', 'newsletter'],
      leadSource: 'referral',
      consents: [],
      suppressions: [],
    }
    expect(
      evaluateSegmentGroup(contact, {
        logic: 'AND',
        rules: [{ field: 'tag', operator: 'neq', value: 'prospect' }],
      }),
    ).toBe(true)
    expect(
      evaluateSegmentGroup(contact, {
        logic: 'AND',
        rules: [{ field: 'leadSource', operator: 'in', value: ['website', 'referral'] }],
      }),
    ).toBe(true)
    expect(
      evaluateSegmentGroup(contact, {
        logic: 'AND',
        rules: [{ field: 'tag', operator: 'in', value: ['prospect'] }],
      }),
    ).toBe(false)
  })

  it('rejects unsupported field and operator combinations', () => {
    const invalidOperator = validateSegmentFilterGroup({
      logic: 'AND',
      rules: [{ field: 'tag', operator: 'gte', value: 'vip' }],
    })
    expect(invalidOperator.ok).toBe(false)
    const invalidIn = validateSegmentFilterGroup({
      logic: 'AND',
      rules: [{ field: 'leadSource', operator: 'in', value: '' }],
    })
    expect(invalidIn.ok).toBe(false)
  })

  it('applies chronological revocation and active suppression to marketing eligibility', () => {
    const base = {
      channel: 'EMAIL' as const,
      purpose: 'MARKETING' as const,
    }
    expect(
      effectiveMarketingConsentGranted(
        [
          { ...base, status: 'GRANTED', capturedAt: new Date('2026-01-01T00:00:00Z') },
          { ...base, status: 'REVOKED', capturedAt: new Date('2026-06-01T00:00:00Z') },
        ],
        [],
      ),
    ).toBe(false)
    expect(
      effectiveMarketingConsentGranted([{ ...base, status: 'GRANTED', capturedAt: new Date('2026-06-01T00:00:00Z') }], [
        { channel: 'EMAIL', purpose: 'MARKETING', active: true },
      ]),
    ).toBe(false)
    expect(
      effectiveMarketingConsentGranted([], []),
    ).toBe(false)
  })

  it('preserves Batch 23 import preview and commit response compatibility', () => {
    const preview: ImportPreview['previewReport'] = {
      duplicates: [{ rowNumber: 2, email: 'a@example.com' }],
      rowCount: 2,
      consentGranted: false,
    }
    expect(previewCrmImportResponseShape(preview)).toBe(true)
    const commit: CrmImportCommitOutcome = {
      importedCount: 3,
      jobId: 'job_1',
      committed: 3,
      skipped: 1,
      rejected: 0,
      duplicates: 0,
    }
    expect(commitCrmImportResponseShape(commit)).toBe(true)
  })

  it('maps merge approval conflicts (409) to workspace errors for UI display', () => {
    const error = classifyWorkspaceError(409, {
      code: 'CONFLICT',
      message: 'Both contacts have different Chatwoot mappings; reconcile Chatwoot links manually before approving merge',
    })
    expect(error.kind).toBe('ERROR')
    expect(error.detail).toMatch(/Chatwoot/i)
  })

  it('maps disabled CRM module responses to NOT_CONFIGURED', () => {
    const error = classifyWorkspaceError(403, { code: 'FORBIDDEN', message: 'CRM import disabled' })
    expect(error.kind).toBe('NOT_CONFIGURED')
  })

  it('English and Spanish CRM merges routes exist', () => {
    expect(readFileSync(join(process.cwd(), 'app/[locale]/dashboard/crm/merges/page.tsx'), 'utf8')).toContain('CrmMergeReview')
    const en = readFileSync(join(process.cwd(), 'lib/i18n/dictionaries/crm-workspace-en.ts'), 'utf8')
    const es = readFileSync(join(process.cwd(), 'lib/i18n/dictionaries/crm-workspace-es.ts'), 'utf8')
    expect(en).toContain('merges:')
    expect(es).toContain('merges:')
  })
})
