import { describe, expect, it } from 'vitest'
import {
  ABMED_CLINICAL_RESEARCH_LEGACY_PREVIEW,
  ABMED_CLINICAL_RESEARCH_PREVIEW,
  ABMED_CLINICAL_RESEARCH_PREVIEW_394A5D8,
  ABMED_CLINICAL_RESEARCH_PREVIEW_B05E0A6,
  ABMED_CLINICAL_RESEARCH_PREVIEW_FC919F5,
  ABMED_CLINICAL_RESEARCH_PROJECT_ID,
  guardKnownDeploymentProject,
  isAbmedClinicalResearchDeployment,
} from '@/lib/website-preview/catalog'
import { parseChangeRequestCategory } from '@/lib/change-requests/categories'

describe('ABMED catalog after batch 24', () => {
  it('guards all known ABMED clinical research immutable deployments', () => {
    for (const deploymentId of [
      ABMED_CLINICAL_RESEARCH_LEGACY_PREVIEW.deploymentId,
      ABMED_CLINICAL_RESEARCH_PREVIEW_394A5D8.deploymentId,
      ABMED_CLINICAL_RESEARCH_PREVIEW_FC919F5.deploymentId,
      ABMED_CLINICAL_RESEARCH_PREVIEW_B05E0A6.deploymentId,
      ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
    ]) {
      expect(isAbmedClinicalResearchDeployment(deploymentId)).toBe(true)
      expect(guardKnownDeploymentProject(ABMED_CLINICAL_RESEARCH_PROJECT_ID, deploymentId)).toEqual({ ok: true })
    }
  })

  it('points staff registration at the latest production deployment', () => {
    expect(ABMED_CLINICAL_RESEARCH_PREVIEW.versionLabel).toBe('cce66a0')
    expect(ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId).toBe('dpl_6vQm7E2MM7xK1V4fH2K65pcFpcQ3')
    expect(ABMED_CLINICAL_RESEARCH_PREVIEW.registeredUrl).toContain('ijpe2q2y1')
    expect(ABMED_CLINICAL_RESEARCH_PREVIEW.sourceRevision.startsWith('cce66a0')).toBe(true)
  })
})

describe('revision request categories', () => {
  it('parses known categories only', () => {
    expect(parseChangeRequestCategory('DESIGN')).toBe('DESIGN')
    expect(parseChangeRequestCategory('invalid')).toBeNull()
  })
})
