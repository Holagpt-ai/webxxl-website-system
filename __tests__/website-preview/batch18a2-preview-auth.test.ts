import { beforeEach, describe, expect, it, vi } from 'vitest'
import { previewApprovalMetadata } from '@/lib/website-preview/binding'
import { ABMED_CLINICAL_RESEARCH_PREVIEW } from '@/lib/website-preview/catalog'

const hoisted = vi.hoisted(() => ({
  requireCustomerMembership: vi.fn(),
  requireStaff: vi.fn(),
  respondApprovalAction: vi.fn(async () => ({ ok: true as const })),
  submitChangeRequestAction: vi.fn(async () => ({ ok: true as const })),
  registerWebsitePreview: vi.fn(async () => ({ ok: true as const })),
  versionFindUnique: vi.fn(),
  projectFindUnique: vi.fn(),
}))

vi.mock('@/lib/portal/authz', () => ({
  requireCustomerMembership: hoisted.requireCustomerMembership,
  requireStaff: hoisted.requireStaff,
}))
vi.mock('@/lib/portal/actions', () => ({
  respondApprovalAction: hoisted.respondApprovalAction,
  submitChangeRequestAction: hoisted.submitChangeRequestAction,
}))
vi.mock('@/lib/website-preview/operations', () => ({
  registerWebsitePreview: hoisted.registerWebsitePreview,
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    websitePreviewVersion: { findUnique: hoisted.versionFindUnique },
    project: { findUnique: hoisted.projectFindUnique },
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { registerWebsitePreviewAction } from '@/lib/website-preview/actions'
import {
  approveWebsitePreviewVersionAction,
  requestWebsitePreviewChangesAction,
} from '@/lib/website-preview/customer-actions'

const metadata = previewApprovalMetadata({
  provider: 'VERCEL',
  deploymentId: ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
  versionLabel: ABMED_CLINICAL_RESEARCH_PREVIEW.versionLabel,
  sourceRevision: ABMED_CLINICAL_RESEARCH_PREVIEW.sourceRevision,
})

function currentVersion(customerAccountId: string) {
  return {
    id: 'version-1',
    isCurrent: true,
    deploymentId: ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
    provider: 'VERCEL',
    approvalId: 'approval-1',
    status: 'READY_FOR_REVIEW',
    versionLabel: ABMED_CLINICAL_RESEARCH_PREVIEW.versionLabel,
    preview: { projectId: 'abmed-clinical-research-project', customerAccountId },
    approval: { id: 'approval-1', metadata, status: 'PENDING' },
  }
}

describe('website preview authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.requireCustomerMembership.mockResolvedValue({
      id: 'customer-1',
      preferredLocale: 'en',
      customerAccount: { id: 'abmed-account' },
    })
  })

  it('refuses a customer approval for another account preview', async () => {
    hoisted.versionFindUnique.mockResolvedValue(currentVersion('other-account'))
    const result = await approveWebsitePreviewVersionAction('version-1', '')
    expect(result).toEqual({ ok: false, error: 'not_found' })
    expect(hoisted.respondApprovalAction).not.toHaveBeenCalled()
  })

  it('approves only through the approval bound to the current deployment', async () => {
    hoisted.versionFindUnique.mockResolvedValue(currentVersion('abmed-account'))
    const result = await approveWebsitePreviewVersionAction('version-1', 'Looks good')
    expect(result).toEqual({ ok: true })
    expect(hoisted.respondApprovalAction).toHaveBeenCalledWith('approval-1', 'APPROVED', 'Looks good')
  })

  it('requires notes before a preview change request', async () => {
    hoisted.versionFindUnique.mockResolvedValue(currentVersion('abmed-account'))
    const result = await requestWebsitePreviewChangesAction('version-1', '   ')
    expect(result).toEqual({ ok: false, error: 'notes_required' })
    expect(hoisted.respondApprovalAction).not.toHaveBeenCalled()
    expect(hoisted.submitChangeRequestAction).not.toHaveBeenCalled()
  })

  it('refuses preview registration without staff access', async () => {
    hoisted.requireStaff.mockRejectedValue(new Error('no'))
    const result = await registerWebsitePreviewAction('project-1', 'VERCEL', 'Name', 'https://example.vercel.app', 'dpl_abcdefgh', '1', '', 'DEVELOPMENT')
    expect(result).toEqual({ ok: false, error: 'unauthorized' })
    expect(hoisted.registerWebsitePreview).not.toHaveBeenCalled()
    expect(hoisted.projectFindUnique).not.toHaveBeenCalled()
  })
})
