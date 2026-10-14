/**
 * Verified external deployments that staff may register by hand.
 * Nothing in this catalog is written to a customer account automatically.
 */
export const ABMED_CLINICAL_RESEARCH_PROJECT_ID = 'abmed-clinical-research-redesign' as const

export const ABMED_CLINICAL_RESEARCH_LEGACY_PREVIEW = {
  key: 'abmed-clinical-research-6499749',
  provider: 'VERCEL',
  displayName: 'ABMED Clinical Research',
  aliasUrl: 'https://abmed-clinical-research.vercel.app',
  registeredUrl: 'https://abmed-clinical-research-e0tp8x0d2-tone4real-7828s-projects.vercel.app',
  deploymentId: 'dpl_BVKpzBn4TLZ3xvyNJYNLBZCFUbNC',
  sourceRevision: '6499749a685bde1ffc437fd1aa25082b8bc379af',
  versionLabel: '6499749',
  status: 'READY_FOR_REVIEW',
} as const

/** Batch 21 production (394a5d8 / concierge scroll). Preserved for review history. */
export const ABMED_CLINICAL_RESEARCH_PREVIEW_394A5D8 = {
  key: 'abmed-clinical-research-394a5d8',
  provider: 'VERCEL',
  displayName: 'ABMED Clinical Research',
  aliasUrl: 'https://abmed-clinical-research.vercel.app',
  registeredUrl: 'https://abmed-clinical-research-ffm790rpp-tone4real-7828s-projects.vercel.app',
  deploymentId: 'dpl_3QdtG4N99p9qfe91L3BwqT4vS5b8',
  sourceRevision: '2b2be46da156c2e5123b9bf2e2f650f4bc5634d0',
  versionLabel: '394a5d8',
  status: 'READY_FOR_REVIEW',
} as const

/** Latest production-verified deployment (Batch 23 UI polish on main, Oct 14 2026). */
export const ABMED_CLINICAL_RESEARCH_PREVIEW = {
  key: 'abmed-clinical-research',
  provider: 'VERCEL',
  displayName: 'ABMED Clinical Research',
  aliasUrl: 'https://abmed-clinical-research.vercel.app',
  registeredUrl: 'https://abmed-clinical-research-2874ke7st-tone4real-7828s-projects.vercel.app/',
  deploymentId: 'dpl_LjyDWEu97w1tgeTG47rtHJsdnJr7',
  sourceRevision: 'fc919f5e390d9ee506ebccd95b90480aae39214e',
  versionLabel: 'fc919f5',
  status: 'READY_FOR_REVIEW',
  customerAccountId: 'abmed-account',
  customerAccountSlug: 'abmed',
  /** Existing ABMED websites. ABMED Clinical Research deployments must not be attached to them. */
  blockedProjectIds: ['abmed-aesthetics-management', 'abmed-physicians-management'] as const,
} as const

const ABMED_GUARDED_DEPLOYMENT_IDS = new Set<string>([
  ABMED_CLINICAL_RESEARCH_LEGACY_PREVIEW.deploymentId,
  ABMED_CLINICAL_RESEARCH_PREVIEW_394A5D8.deploymentId,
  ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
])

export function abmedClinicalResearchRegistration() {
  return {
    provider: ABMED_CLINICAL_RESEARCH_PREVIEW.provider,
    displayName: ABMED_CLINICAL_RESEARCH_PREVIEW.displayName,
    aliasUrl: ABMED_CLINICAL_RESEARCH_PREVIEW.aliasUrl,
    registeredUrl: ABMED_CLINICAL_RESEARCH_PREVIEW.registeredUrl,
    deploymentId: ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId,
    versionLabel: ABMED_CLINICAL_RESEARCH_PREVIEW.versionLabel,
    sourceRevision: ABMED_CLINICAL_RESEARCH_PREVIEW.sourceRevision,
    status: ABMED_CLINICAL_RESEARCH_PREVIEW.status,
  }
}

export function isAbmedClinicalResearchDeployment(deploymentId: string): boolean {
  return ABMED_GUARDED_DEPLOYMENT_IDS.has(deploymentId)
}

export function guardKnownDeploymentProject(
  projectId: string,
  deploymentId: string,
): { ok: true } | { ok: false; error: 'abmed_existing_project' } {
  if (!isAbmedClinicalResearchDeployment(deploymentId)) return { ok: true }
  if (projectId === ABMED_CLINICAL_RESEARCH_PROJECT_ID) return { ok: true }
  return { ok: false, error: 'abmed_existing_project' }
}

export function guardKnownDeploymentAccount(
  customerAccountId: string,
  deploymentId: string,
): { ok: true } | { ok: false; error: 'abmed_wrong_account' } {
  if (!isAbmedClinicalResearchDeployment(deploymentId)) return { ok: true }
  if (customerAccountId !== ABMED_CLINICAL_RESEARCH_PREVIEW.customerAccountId) {
    return { ok: false, error: 'abmed_wrong_account' }
  }
  return { ok: true }
}
