const WEBSITE_PROJECT_TYPES = new Set(['WEBSITE', 'REDESIGN', 'LANDING', 'ECOMMERCE'])

export function isWebsiteProjectType(type: string): boolean {
  return WEBSITE_PROJECT_TYPES.has(type)
}

/** Customer review always loads the immutable deployment URL, never the mutable alias. */
export function customerPreviewDeploymentUrl(version: { registeredUrl: string }): string {
  return version.registeredUrl
}

export function previewChangeRequestTitle(locale: string, versionLabel: string): string {
  if (locale === 'es') return `Vista previa del sitio ${versionLabel}`
  return `Website preview ${versionLabel}`
}

export function previewChangeRequestDescription(notes: string, deploymentId: string): string {
  const body = notes.trim()
  const marker = `Deployment: ${deploymentId}`
  if (!body) return marker
  if (body.includes(deploymentId)) return body
  return `${body}\n\n${marker}`
}

export function previewActionError(
  code: string,
  errors: {
    unauthorized: string
    notFound: string
    invalid: string
    superseded: string
    failed: string
    notesRequired: string
  },
): string {
  if (code === 'unauthorized') return errors.unauthorized
  if (code === 'not_found') return errors.notFound
  if (code === 'invalid' || code === 'empty' || code === 'invalid_url' || code === 'invalid_deployment') return errors.invalid
  if (code === 'superseded') return errors.superseded
  if (code === 'notes_required') return errors.notesRequired
  return errors.failed
}
