import { describe, expect, it } from 'vitest'
import {
  ABMED_CLINICAL_RESEARCH_LEGACY_PREVIEW,
  ABMED_CLINICAL_RESEARCH_PREVIEW,
  ABMED_CLINICAL_RESEARCH_PREVIEW_394A5D8,
  ABMED_CLINICAL_RESEARCH_PROJECT_ID,
  guardKnownDeploymentProject,
  isAbmedClinicalResearchDeployment,
} from '@/lib/website-preview/catalog'
import { parseChangeRequestCategory } from '@/lib/change-requests/categories'

describe('ABMED catalog after batch 24', () => {
  it('guards all three known immutable deployments', () => {
    for (const deploymentId of [
      ABMED_CLINICAL_RESEARCH_LEGACY_PREVIEW.deploymentId,
      ABMED_CLINICAL_RESEARCH_PREVIEW_394A5D8.deploymentId,
      ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
    ]) {
      expect(isAbmedClinicalResearchDeployment(deploymentId)).toBe(true)
      expect(guardKnownDeploymentProject(ABMED_CLINICAL_RESEARCH_PROJECT_ID, deploymentId)).toEqual({ ok: true })
    }
  })

  it('registers batch 23 production metadata', () => {
    expect(ABMED_CLINICAL_RESEARCH_PREVIEW.versionLabel).toBe('fc919f5')
    expect(ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId).toBe('dpl_LjyDWEu97w1tgeTG47rtHJsdnJr7')
    expect(ABMED_CLINICAL_RESEARCH_PREVIEW.registeredUrl).toContain('2874ke7st')
    expect(ABMED_CLINICAL_RESEARCH_PREVIEW.sourceRevision.startsWith('fc919f5')).toBe(true)
  })
})

describe('revision request categories', () => {
  it('parses known categories only', () => {
    expect(parseChangeRequestCategory('DESIGN')).toBe('DESIGN')
    expect(parseChangeRequestCategory('invalid')).toBeNull()
  })
})
