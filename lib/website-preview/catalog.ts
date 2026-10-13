/**
 * Verified external deployments that staff may register by hand.
 * Nothing in this catalog is written to a customer account automatically.
 */
export const ABMED_CLINICAL_RESEARCH_PREVIEW = {
  key: 'abmed-clinical-research',
  provider: 'VERCEL',
  displayName: 'ABMED Clinical Research',
  aliasUrl: 'https://abmed-clinical-research.vercel.app',
  deploymentId: 'dpl_BVKpzBn4TLZ3xvyNJYNLBZCFUbNC',
  sourceRevision: '6499749a685bde1ffc437fd1aa25082b8bc379af',
  versionLabel: '6499749',
  status: 'READY_FOR_REVIEW',
  customerAccountId: 'abmed-account',
  customerAccountSlug: 'abmed',
  /** Existing ABMED websites. This deployment must not be attached to them. */
  blockedProjectIds: ['abmed-aesthetics-management', 'abmed-physicians-management'] as const,
} as const

export function abmedClinicalResearchRegistration() {
  return {
    provider: ABMED_CLINICAL_RESEARCH_PREVIEW.provider,
    displayName: ABMED_CLINICAL_RESEARCH_PREVIEW.displayName,
    aliasUrl: ABMED_CLINICAL_RESEARCH_PREVIEW.aliasUrl,
    deploymentId: ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
    versionLabel: ABMED_CLINICAL_RESEARCH_PREVIEW.versionLabel,
    sourceRevision: ABMED_CLINICAL_RESEARCH_PREVIEW.sourceRevision,
    status: ABMED_CLINICAL_RESEARCH_PREVIEW.status,
  }
}

export function guardKnownDeploymentProject(
  projectId: string,
  deploymentId: string,
): { ok: true } | { ok: false; error: 'abmed_existing_project' } {
  if (deploymentId !== ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId) return { ok: true }
  if (
    (ABMED_CLINICAL_RESEARCH_PREVIEW.blockedProjectIds as readonly string[]).includes(projectId)
  ) {
    return { ok: false, error: 'abmed_existing_project' }
  }
  return { ok: true }
}
