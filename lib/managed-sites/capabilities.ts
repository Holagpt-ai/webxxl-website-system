import type { CapabilityExecutionMode } from '@prisma/client'

export type CapabilityRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type CapabilityDefinition = {
  key: string
  label: { en: string; es: string }
  description: { en: string; es: string }
  executionMode: CapabilityExecutionMode
  requiresApproval: boolean
  customerVisible: boolean
  enabledByDefault: boolean
  riskLevel: CapabilityRiskLevel
  /** Allowed structured-editor fields. Empty means no editor is registered yet. */
  editorFields: readonly string[]
}

/**
 * What may be performed against a specific customer website.
 * This is separate from the portal module registry, which only lists WebXXL sections.
 * enabledByDefault is a suggestion for new assignments. It never grants access by itself.
 */
export const CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = [
  {
    key: 'campaigns.view',
    label: { en: 'View campaigns', es: 'Ver campañas' },
    description: { en: 'See campaign status for this website.', es: 'Consulta el estado de las campañas de este sitio.' },
    executionMode: 'READ_ONLY',
    requiresApproval: false,
    customerVisible: true,
    enabledByDefault: false,
    riskLevel: 'LOW',
    editorFields: [],
  },
  {
    key: 'campaigns.manage',
    label: { en: 'Manage campaigns', es: 'Administrar campañas' },
    description: { en: 'Request campaign scheduling and on/off changes.', es: 'Solicita cambios de fechas y activación de campañas.' },
    executionMode: 'SELF_SERVICE',
    requiresApproval: true,
    customerVisible: true,
    enabledByDefault: false,
    riskLevel: 'MEDIUM',
    editorFields: ['active', 'startsAt', 'endsAt'],
  },
  {
    key: 'popups.view',
    label: { en: 'View popups', es: 'Ver ventanas emergentes' },
    description: { en: 'See popup content for this website.', es: 'Consulta el contenido de las ventanas emergentes de este sitio.' },
    executionMode: 'READ_ONLY',
    requiresApproval: false,
    customerVisible: true,
    enabledByDefault: false,
    riskLevel: 'LOW',
    editorFields: [],
  },
  {
    key: 'popups.manage',
    label: { en: 'Manage popups', es: 'Administrar ventanas emergentes' },
    description: {
      en: 'Request popup title, body, image, call to action, and schedule changes.',
      es: 'Solicita cambios de título, texto, imagen, llamado a la acción y fechas.',
    },
    executionMode: 'SELF_SERVICE',
    requiresApproval: true,
    customerVisible: true,
    enabledByDefault: false,
    riskLevel: 'MEDIUM',
    editorFields: ['title', 'body', 'imageUrl', 'ctaText', 'ctaUrl', 'active', 'startsAt', 'endsAt'],
  },
  {
    key: 'business_info.edit',
    label: { en: 'Business information', es: 'Información del negocio' },
    description: { en: 'Request updates to approved business details.', es: 'Solicita cambios en los datos comerciales aprobados.' },
    executionMode: 'SELF_SERVICE',
    requiresApproval: false,
    customerVisible: true,
    enabledByDefault: false,
    riskLevel: 'LOW',
    editorFields: ['businessName', 'phone', 'email', 'address'],
  },
  {
    key: 'content.edit',
    label: { en: 'Edit content', es: 'Editar contenido' },
    description: {
      en: 'Describe a content change. AI drafting is not connected yet.',
      es: 'Describe un cambio de contenido. La redacción con IA aún no está conectada.',
    },
    executionMode: 'AI_ASSISTED',
    requiresApproval: true,
    customerVisible: true,
    enabledByDefault: false,
    riskLevel: 'MEDIUM',
    editorFields: ['summary', 'fields'],
  },
  {
    key: 'images.replace',
    label: { en: 'Replace images', es: 'Reemplazar imágenes' },
    description: { en: 'Request a replacement for an approved image.', es: 'Solicita reemplazar una imagen aprobada.' },
    executionMode: 'SELF_SERVICE',
    requiresApproval: true,
    customerVisible: true,
    enabledByDefault: false,
    riskLevel: 'LOW',
    editorFields: ['slot', 'imageUrl'],
  },
  {
    key: 'seo.edit',
    label: { en: 'Edit SEO fields', es: 'Editar campos SEO' },
    description: { en: 'Request title and description updates.', es: 'Solicita cambios de título y descripción.' },
    executionMode: 'SELF_SERVICE',
    requiresApproval: true,
    customerVisible: true,
    enabledByDefault: false,
    riskLevel: 'MEDIUM',
    editorFields: ['title', 'description'],
  },
  {
    key: 'analytics.view',
    label: { en: 'View analytics', es: 'Ver analítica' },
    description: { en: 'See website analytics when a source is connected.', es: 'Consulta la analítica cuando haya una fuente conectada.' },
    executionMode: 'READ_ONLY',
    requiresApproval: false,
    customerVisible: true,
    enabledByDefault: false,
    riskLevel: 'LOW',
    editorFields: [],
  },
  {
    key: 'scheduler.manage',
    label: { en: 'Manage scheduler', es: 'Administrar el programador' },
    description: { en: 'Request scheduler changes for this website.', es: 'Solicita cambios del programador de este sitio.' },
    executionMode: 'SELF_SERVICE',
    requiresApproval: true,
    customerVisible: true,
    enabledByDefault: false,
    riskLevel: 'MEDIUM',
    editorFields: [],
  },
  {
    key: 'site.custom_work',
    label: { en: 'Custom site work', es: 'Trabajo personalizado del sitio' },
    description: {
      en: 'Redesigns, new features, and other work WebXXL must do.',
      es: 'Rediseños, funciones nuevas y otro trabajo que debe hacer WebXXL.',
    },
    executionMode: 'HUMAN_REQUIRED',
    requiresApproval: false,
    customerVisible: true,
    enabledByDefault: false,
    riskLevel: 'HIGH',
    editorFields: [],
  },
  {
    key: 'site.connection',
    label: { en: 'Connection diagnostics', es: 'Diagnóstico de conexión' },
    description: { en: 'Staff-only view of how this site is connected.', es: 'Vista interna de cómo está conectado este sitio.' },
    executionMode: 'READ_ONLY',
    requiresApproval: true,
    customerVisible: false,
    enabledByDefault: false,
    riskLevel: 'HIGH',
    editorFields: [],
  },
] as const

const BY_KEY = new Map(CAPABILITY_DEFINITIONS.map((definition) => [definition.key, definition]))

export function getCapabilityDefinition(key: string): CapabilityDefinition | null {
  return BY_KEY.get(key) ?? null
}

export function isKnownCapability(key: string): boolean {
  return BY_KEY.has(key)
}

export type CapabilityAssignment = {
  capabilityKey: string
  enabled: boolean
  executionMode: CapabilityExecutionMode | null
}

export type EffectiveCapability = CapabilityDefinition & {
  enabled: boolean
  executionMode: CapabilityExecutionMode
}

/** Server assignment wins. A client-supplied mode is ignored. */
export function resolveEffectiveCapability(
  capabilityKey: string,
  assignment: CapabilityAssignment | null,
  _clientExecutionMode?: unknown,
): EffectiveCapability | null {
  const definition = getCapabilityDefinition(capabilityKey)
  if (!definition) return null
  const enabled = assignment?.enabled === true && assignment.capabilityKey === capabilityKey
  return {
    ...definition,
    enabled,
    executionMode: assignment?.executionMode ?? definition.executionMode,
  }
}

export function getCustomerVisibleCapabilities(assignments: CapabilityAssignment[]): EffectiveCapability[] {
  return CAPABILITY_DEFINITIONS.flatMap((definition) => {
    if (!definition.customerVisible) return []
    const assignment = assignments.find((item) => item.capabilityKey === definition.key) ?? null
    const effective = resolveEffectiveCapability(definition.key, assignment)
    if (!effective?.enabled) return []
    return [effective]
  })
}

export function capabilityHasEditor(definition: CapabilityDefinition): boolean {
  return definition.editorFields.length > 0 && definition.executionMode === 'SELF_SERVICE'
}
