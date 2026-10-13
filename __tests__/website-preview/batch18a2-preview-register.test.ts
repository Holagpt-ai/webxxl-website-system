import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ABMED_CLINICAL_RESEARCH_PREVIEW } from '@/lib/website-preview/catalog'

const hoisted = vi.hoisted(() => {
  const approvalCreate = vi.fn(async () => ({ id: 'approval-1' }))
  const versionCreate = vi.fn(async () => ({ id: 'version-1' }))
  const versionFindUnique = vi.fn()
  const changeRequestCreate = vi.fn(async () => ({ id: 'cr-1' }))
  const versionUpdate = vi.fn(async () => ({}))
  const previewUpdate = vi.fn(async () => ({}))
  return {
    approvalCreate,
    versionCreate,
    versionFindUnique,
    changeRequestCreate,
    versionUpdate,
    previewUpdate,
    writeProjectActivity: vi.fn(async () => ({})),
    approvalRequested: vi.fn(async () => undefined),
    changeRequestSubmitted: vi.fn(async () => undefined),
  }
})

vi.mock('@/lib/db', () => ({
  prisma: {
    websitePreviewVersion: {
      findUnique: hoisted.versionFindUnique,
      update: hoisted.versionUpdate,
    },
    websitePreview: { update: hoisted.previewUpdate },
    changeRequest: { create: hoisted.changeRequestCreate },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        websitePreview: { upsert: vi.fn(async () => ({ id: 'preview-1' })) },
        websitePreviewVersion: {
          findMany: vi.fn(async () => []),
          update: vi.fn(),
          create: hoisted.versionCreate,
        },
        projectApproval: { create: hoisted.approvalCreate, update: vi.fn() },
      }),
  },
}))

vi.mock('@/lib/portal/activity', () => ({
  writeProjectActivity: hoisted.writeProjectActivity,
  formatActivitySummary: (type: string, detail: string) => `${type}:${detail}`,
}))

vi.mock('@/lib/automation/hooks', () => ({
  automationHooks: {
    approvalRequested: hoisted.approvalRequested,
    changeRequestSubmitted: hoisted.changeRequestSubmitted,
  },
}))

import { registerWebsitePreview, syncWebsitePreviewDecision } from '@/lib/website-preview/operations'

const verified = {
  provider: ABMED_CLINICAL_RESEARCH_PREVIEW.provider,
  displayName: ABMED_CLINICAL_RESEARCH_PREVIEW.displayName,
  aliasUrl: ABMED_CLINICAL_RESEARCH_PREVIEW.aliasUrl,
  deploymentId: ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
  versionLabel: ABMED_CLINICAL_RESEARCH_PREVIEW.versionLabel,
  sourceRevision: ABMED_CLINICAL_RESEARCH_PREVIEW.sourceRevision,
  status: ABMED_CLINICAL_RESEARCH_PREVIEW.status,
}

describe('website preview registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.versionFindUnique.mockResolvedValue(null)
  })

  it('does not write when the clinical research deployment targets an existing ABMED website project', async () => {
    const result = await registerWebsitePreview({
      actorUserId: 'staff-1',
      project: { id: 'abmed-aesthetics-management', customerAccountId: 'abmed-account' },
      ...verified,
    })
    expect(result).toEqual({ ok: false, error: 'abmed_existing_project' })
    expect(hoisted.versionFindUnique).not.toHaveBeenCalled()
    expect(hoisted.approvalCreate).not.toHaveBeenCalled()
  })

  it('creates the approval against the deployment id, not the preview address', async () => {
    const result = await registerWebsitePreview({
      actorUserId: 'staff-1',
      project: { id: 'abmed-clinical-research-project', customerAccountId: 'abmed-account' },
      ...verified,
    })
    expect(result).toEqual({ ok: true })
    expect(hoisted.approvalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: verified.deploymentId,
        metadata: expect.objectContaining({
          kind: 'website_preview',
          deploymentId: verified.deploymentId,
        }),
      }),
    })
    expect(JSON.stringify(hoisted.approvalCreate.mock.calls)).not.toContain('vercel.app')
    expect(hoisted.versionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deploymentId: verified.deploymentId,
        isCurrent: true,
        approvalId: 'approval-1',
      }),
    })
    expect(hoisted.approvalRequested).toHaveBeenCalledWith(expect.objectContaining({ approvalId: 'approval-1', customerAccountId: 'abmed-account' }))
  })
})

describe('preview decision sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens a change request for the current deployment when changes are requested', async () => {
    hoisted.versionFindUnique.mockResolvedValue({
      id: 'version-1',
      isCurrent: true,
      deploymentId: verified.deploymentId,
      versionLabel: verified.versionLabel,
      provider: 'VERCEL',
      changeRequestId: null,
      previewId: 'preview-1',
      preview: { projectId: 'abmed-clinical-research-project', customerAccountId: 'abmed-account' },
    })
    await syncWebsitePreviewDecision({
      approvalId: 'approval-1',
      decision: 'CHANGES_REQUESTED',
      actorUserId: 'customer-1',
      notes: 'Update the hero',
      locale: 'es',
    })
    expect(hoisted.changeRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'abmed-clinical-research-project',
        title: `Vista previa del sitio ${verified.versionLabel}`,
        description: expect.stringContaining(verified.deploymentId),
      }),
    })
    expect(hoisted.previewUpdate).toHaveBeenCalledWith({
      where: { id: 'preview-1' },
      data: { status: 'CHANGES_REQUESTED' },
    })
  })

  it('does not move an old deployment decision onto the current preview', async () => {
    hoisted.versionFindUnique.mockResolvedValue({
      id: 'version-old',
      isCurrent: false,
      deploymentId: 'dpl_olddeployment',
      versionLabel: 'old',
      provider: 'VERCEL',
      changeRequestId: null,
      previewId: 'preview-1',
      preview: { projectId: 'abmed-clinical-research-project', customerAccountId: 'abmed-account' },
    })
    await syncWebsitePreviewDecision({
      approvalId: 'approval-old',
      decision: 'APPROVED',
      actorUserId: 'customer-1',
    })
    expect(hoisted.versionUpdate).not.toHaveBeenCalled()
    expect(hoisted.previewUpdate).not.toHaveBeenCalled()
    expect(hoisted.changeRequestCreate).not.toHaveBeenCalled()
  })
})
