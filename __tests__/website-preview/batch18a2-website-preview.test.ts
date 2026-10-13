import { describe, expect, it } from 'vitest'
import { pickActiveProject } from '@/lib/portal/active-project'
import { ABMED_CLINICAL_RESEARCH_PREVIEW, guardKnownDeploymentProject } from '@/lib/website-preview/catalog'
import { previewApprovalMetadata, previewDecisionIsBound } from '@/lib/website-preview/binding'
import { previewChangeRequestDescription } from '@/lib/website-preview/display'
import { parseWebsitePreviewInput, validatePreviewUrl } from '@/lib/website-preview/validation'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { formatActivitySummary } from '@/lib/portal/activity'

const verified = {
  provider: ABMED_CLINICAL_RESEARCH_PREVIEW.provider,
  displayName: ABMED_CLINICAL_RESEARCH_PREVIEW.displayName,
  aliasUrl: ABMED_CLINICAL_RESEARCH_PREVIEW.aliasUrl,
  deploymentId: ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
  versionLabel: ABMED_CLINICAL_RESEARCH_PREVIEW.versionLabel,
  sourceRevision: ABMED_CLINICAL_RESEARCH_PREVIEW.sourceRevision,
  status: ABMED_CLINICAL_RESEARCH_PREVIEW.status,
}

const aesthetics = {
  id: 'abmed-aesthetics-management',
  name: 'ABMED Aesthetics — Website Management',
  status: 'ACTIVE',
  updatedAt: new Date('2026-10-10T21:35:59.751Z'),
}
const physicians = {
  id: 'abmed-physicians-management',
  name: 'ABMED Physicians Group — Website Management',
  status: 'ACTIVE',
  updatedAt: new Date('2026-10-10T21:35:59.751Z'),
}

describe('project selection keeps every account project reachable', () => {
  it('uses the selected project even when another active project is newer in the default order', () => {
    const selected = pickActiveProject([aesthetics, physicians], physicians.id)
    expect(selected.project?.id).toBe(physicians.id)
    expect(selected.shouldRefreshCookie).toBe(false)
  })

  it('falls back inside the account when the cookie points at a different account project', () => {
    const fallback = pickActiveProject([physicians, aesthetics], 'clinical-research-on-another-account')
    expect(fallback.shouldRefreshCookie).toBe(true)
    expect(fallback.project?.id).toBe(aesthetics.id)
  })
})

describe('website preview URL and deployment validation', () => {
  it('accepts the verified ABMED Vercel preview and rejects aliases used as deployment ids', () => {
    const parsed = parseWebsitePreviewInput(verified)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.aliasUrl).toBe('https://abmed-clinical-research.vercel.app/')
    expect(parsed.value.deploymentId).toBe('dpl_BVKpzBn4TLZ3xvyNJYNLBZCFUbNC')
    expect(parsed.value.deploymentId).not.toBe(parsed.value.aliasUrl)
  })

  it('rejects non-https, private, and cross-provider hosts', () => {
    expect(validatePreviewUrl('http://abmed-clinical-research.vercel.app', 'VERCEL').ok).toBe(false)
    expect(validatePreviewUrl('https://127.0.0.1', 'OTHER').ok).toBe(false)
    expect(validatePreviewUrl('https://user:pass@abmed-clinical-research.vercel.app', 'VERCEL').ok).toBe(false)
    expect(validatePreviewUrl('https://evil.example', 'VERCEL').ok).toBe(false)
    expect(parseWebsitePreviewInput({ ...verified, deploymentId: verified.aliasUrl }).ok).toBe(false)
    expect(parseWebsitePreviewInput({ ...verified, status: 'APPROVED' }).ok).toBe(false)
  })
})

describe('approval binding follows the immutable deployment', () => {
  const metadata = previewApprovalMetadata({
    provider: 'VERCEL',
    deploymentId: verified.deploymentId,
    versionLabel: verified.versionLabel,
    sourceRevision: verified.sourceRevision,
  })
  const version = {
    isCurrent: true,
    deploymentId: verified.deploymentId,
    provider: 'VERCEL',
    approvalId: 'approval-1',
    status: 'READY_FOR_REVIEW',
  }

  it('stays bound when only the alias would have changed', () => {
    expect(previewDecisionIsBound({ version, approvalId: 'approval-1', approvalMetadata: metadata })).toBe(true)
    expect(metadata.deploymentId).toBe(verified.deploymentId)
    expect(JSON.stringify(metadata)).not.toContain('vercel.app')
  })

  it('refuses a stale version or a different deployment id', () => {
    expect(
      previewDecisionIsBound({
        version: { ...version, isCurrent: false },
        approvalId: 'approval-1',
        approvalMetadata: metadata,
      }),
    ).toBe(false)
    expect(
      previewDecisionIsBound({
        version,
        approvalId: 'approval-1',
        approvalMetadata: { ...metadata, deploymentId: 'dpl_otherdeployment' },
      }),
    ).toBe(false)
  })

  it('keeps the deployment id in a change-request description', () => {
    const description = previewChangeRequestDescription('Move the phone number', verified.deploymentId)
    expect(description).toContain('Move the phone number')
    expect(description).toContain(verified.deploymentId)
  })
})

describe('ABMED clinical research activation guard', () => {
  it('blocks the verified deployment on the existing aesthetics and physicians projects', () => {
    expect(guardKnownDeploymentProject(aesthetics.id, verified.deploymentId)).toEqual({
      ok: false,
      error: 'abmed_existing_project',
    })
    expect(guardKnownDeploymentProject(physicians.id, verified.deploymentId)).toEqual({
      ok: false,
      error: 'abmed_existing_project',
    })
    expect(guardKnownDeploymentProject('abmed-clinical-research-project', verified.deploymentId)).toEqual({ ok: true })
    expect(guardKnownDeploymentProject(aesthetics.id, 'dpl_someotherdeploy')).toEqual({ ok: true })
  })
})

describe('website preview copy', () => {
  it('has matching English and Spanish preview labels', () => {
    const en = getDictionary('en')
    const es = getDictionary('es')
    expect(Object.keys(es.dashboard.websitePreviewStatuses).sort()).toEqual(Object.keys(en.dashboard.websitePreviewStatuses).sort())
    expect(Object.keys(es.admin.websitePreview.errors).sort()).toEqual(Object.keys(en.admin.websitePreview.errors).sort())
    expect(es.dashboard.approveVersion).not.toBe(en.dashboard.approveVersion)
    expect(es.dashboard.openPreviewWebsite).not.toBe(en.dashboard.openPreviewWebsite)
    expect(formatActivitySummary('WEBSITE_PREVIEW_REGISTERED', verified.deploymentId)).toContain(verified.deploymentId)
  })
})
