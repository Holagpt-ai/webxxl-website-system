import { describe, expect, it } from 'vitest'
import {
  ABMED_CLINICAL_RESEARCH_PREVIEW,
  ABMED_CLINICAL_RESEARCH_PROJECT_ID,
  guardKnownDeploymentAccount,
  guardKnownDeploymentProject,
} from '@/lib/website-preview/catalog'
import { previewApprovalMetadata, previewDecisionIsBound } from '@/lib/website-preview/binding'
import { dependencyActionHref } from '@/lib/portal/dependency-actions'
import { calculateProjectProgress } from '@/lib/portal/progress'
import { STANDARD_BUSINESS_WEBSITE_TEMPLATE } from '@/lib/project-templates/standard-business-website'

/** Read-only production snapshot (Batch 28.2 acceptance); do not mutate live ABMED rows in tests. */
const ABMED_PRODUCTION_SNAPSHOT = {
  projectId: 'abmed-clinical-research-redesign',
  customerAccountId: 'abmed-account',
  progressPercent: 45,
  currentVersionLabel: 'cce66a0',
  currentDeploymentId: 'dpl_6vQm7E2MM7xK1V4fH2K65pcFpcQ3',
  currentApprovalId: 'abmed-clinical-research-approval-cce66a0',
  dependencies: [
    { id: 'abmed-cr-dep-studies', customerActionKey: 'WEBSITE_REVIEW' },
    { id: 'abmed-cr-dep-media', customerActionKey: 'FILES' },
    { id: 'abmed-cr-dep-privacy', customerActionKey: 'APPROVALS' },
  ],
} as const

describe('batch 28.2 workflow acceptance (code + production snapshot)', () => {
  it('keeps staff catalog aligned with registered ABMED production deployment', () => {
    expect(ABMED_CLINICAL_RESEARCH_PREVIEW.versionLabel).toBe(ABMED_PRODUCTION_SNAPSHOT.currentVersionLabel)
    expect(ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId).toBe(ABMED_PRODUCTION_SNAPSHOT.currentDeploymentId)
    expect(guardKnownDeploymentProject(ABMED_PRODUCTION_SNAPSHOT.projectId, ABMED_PRODUCTION_SNAPSHOT.currentDeploymentId)).toEqual({
      ok: true,
    })
    expect(
      guardKnownDeploymentAccount(ABMED_PRODUCTION_SNAPSHOT.customerAccountId, ABMED_PRODUCTION_SNAPSHOT.currentDeploymentId),
    ).toEqual({ ok: true })
    expect(guardKnownDeploymentProject('abmed-aesthetics-management', ABMED_PRODUCTION_SNAPSHOT.currentDeploymentId)).toEqual({
      ok: false,
      error: 'abmed_existing_project',
    })
  })

  it('routes ABMED dependency action keys to the correct customer destinations', () => {
    const prefix = '/en'
    expect(dependencyActionHref('WEBSITE_REVIEW', prefix)).toBe(`${prefix}/dashboard/project`)
    expect(dependencyActionHref('FILES', prefix)).toBe(`${prefix}/dashboard/files`)
    expect(dependencyActionHref('APPROVALS', prefix)).toBe(`${prefix}/dashboard/approvals`)
    for (const dep of ABMED_PRODUCTION_SNAPSHOT.dependencies) {
      expect(dependencyActionHref(dep.customerActionKey, prefix)).not.toBeNull()
    }
  })

  it('binds preview approvals to immutable deployment metadata per version', () => {
    const deploymentId = ABMED_PRODUCTION_SNAPSHOT.currentDeploymentId
    const metadata = previewApprovalMetadata({
      provider: 'VERCEL',
      deploymentId,
      versionLabel: ABMED_PRODUCTION_SNAPSHOT.currentVersionLabel,
      sourceRevision: ABMED_CLINICAL_RESEARCH_PREVIEW.sourceRevision,
    })
    const version = {
      deploymentId,
      provider: 'VERCEL',
      isCurrent: true,
      status: 'READY_FOR_REVIEW',
      approvalId: ABMED_PRODUCTION_SNAPSHOT.currentApprovalId,
    }
    expect(
      previewDecisionIsBound({
        version,
        approvalId: ABMED_PRODUCTION_SNAPSHOT.currentApprovalId,
        approvalMetadata: metadata,
      }),
    ).toBe(true)
    expect(
      previewDecisionIsBound({
        version: { ...version, deploymentId: 'dpl_other' },
        approvalId: ABMED_PRODUCTION_SNAPSHOT.currentApprovalId,
        approvalMetadata: metadata,
      }),
    ).toBe(false)
  })

  it('matches ABMED production milestone weights at 45% completion', () => {
    const abmedWeights = [
      { progressWeight: 10, status: 'COMPLETED' as const },
      { progressWeight: 20, status: 'COMPLETED' as const },
      { progressWeight: 15, status: 'COMPLETED' as const },
      { progressWeight: 20, status: 'IN_PROGRESS' as const },
      { progressWeight: 15, status: 'PENDING' as const },
      { progressWeight: 10, status: 'PENDING' as const },
      { progressWeight: 5, status: 'PENDING' as const },
      { progressWeight: 5, status: 'PENDING' as const },
    ]
    expect(calculateProjectProgress(abmedWeights.map((m, i) => ({ id: `m-${i}`, title: `M${i}`, ...m })))).toBe(
      ABMED_PRODUCTION_SNAPSHOT.progressPercent,
    )
  })

  it('initializes onboarding template with eight milestones and three dependencies', () => {
    expect(STANDARD_BUSINESS_WEBSITE_TEMPLATE.milestones).toHaveLength(8)
    expect(STANDARD_BUSINESS_WEBSITE_TEMPLATE.dependencies).toHaveLength(3)
  })
})
