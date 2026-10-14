import { describe, expect, it } from 'vitest'
import {
  ABMED_CLINICAL_RESEARCH_LEGACY_PREVIEW,
  ABMED_CLINICAL_RESEARCH_PREVIEW,
  ABMED_CLINICAL_RESEARCH_PREVIEW_394A5D8,
  ABMED_CLINICAL_RESEARCH_PREVIEW_FC919F5,
  ABMED_CLINICAL_RESEARCH_PROJECT_ID,
  guardKnownDeploymentProject,
  isAbmedClinicalResearchDeployment,
} from '@/lib/website-preview/catalog'
import { calculateProjectEta } from '@/lib/portal/eta'

describe('ABMED clinical research catalog', () => {
  it('guards all known ABMED deployment ids to the clinical research project', () => {
    for (const deploymentId of [
      ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
      ABMED_CLINICAL_RESEARCH_PREVIEW_FC919F5.deploymentId,
      ABMED_CLINICAL_RESEARCH_PREVIEW_394A5D8.deploymentId,
      ABMED_CLINICAL_RESEARCH_LEGACY_PREVIEW.deploymentId,
    ]) {
      expect(isAbmedClinicalResearchDeployment(deploymentId)).toBe(true)
      expect(guardKnownDeploymentProject(ABMED_CLINICAL_RESEARCH_PROJECT_ID, deploymentId)).toEqual({ ok: true })
      expect(guardKnownDeploymentProject('abmed-aesthetics-management', deploymentId)).toEqual({
        ok: false,
        error: 'abmed_existing_project',
      })
    }
  })
})

describe('ABMED progress after AI concierge delivery', () => {
  it('stays at 45% until the combined AI/contact milestone completes', () => {
    const eta = calculateProjectEta({
      projectStatus: 'ACTIVE',
      targetDate: null,
      estimatedCompletionDate: null,
      milestones: [
        { title: 'M1', status: 'COMPLETED', progressWeight: 10, targetDate: null, completedAt: null },
        { title: 'M2', status: 'COMPLETED', progressWeight: 20, targetDate: null, completedAt: null },
        { title: 'M3', status: 'COMPLETED', progressWeight: 15, targetDate: null, completedAt: null },
        { title: 'M4', status: 'IN_PROGRESS', progressWeight: 20, targetDate: null, completedAt: null },
        { title: 'M5', status: 'PENDING', progressWeight: 15, targetDate: null, completedAt: null },
        { title: 'M6', status: 'PENDING', progressWeight: 10, targetDate: null, completedAt: null },
        { title: 'M7', status: 'PENDING', progressWeight: 5, targetDate: null, completedAt: null },
        { title: 'M8', status: 'PENDING', progressWeight: 5, targetDate: null, completedAt: null },
      ],
      customerOpenDependencies: [{ status: 'REQUESTED', dueDate: null }],
    })
    expect(eta.progressPercent).toBe(45)
  })
})
