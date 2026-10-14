import type { ProjectType } from '@prisma/client'
import type { ProjectTemplateDefinition } from '@/lib/project-templates/types'
import { STANDARD_BUSINESS_WEBSITE_TEMPLATE } from '@/lib/project-templates/standard-business-website'

const TEMPLATES: ProjectTemplateDefinition[] = [STANDARD_BUSINESS_WEBSITE_TEMPLATE]

export function listProjectTemplates(): ProjectTemplateDefinition[] {
  return TEMPLATES
}

export function getProjectTemplate(templateId: string): ProjectTemplateDefinition | null {
  return TEMPLATES.find((t) => t.id === templateId) ?? null
}

export function parseProjectTemplateId(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return getProjectTemplate(value.trim()) ? value.trim() : null
}

const WEBSITE_TEMPLATE_PROJECT_TYPES = new Set<ProjectType>(['WEBSITE', 'REDESIGN', 'LANDING', 'ECOMMERCE'])

/** Default Batch 26 template for website-style projects; null when staff should not auto-apply a website template. */
export function defaultWebsiteTemplateIdForProjectType(projectType: ProjectType): string | null {
  if (!WEBSITE_TEMPLATE_PROJECT_TYPES.has(projectType)) return null
  return STANDARD_BUSINESS_WEBSITE_TEMPLATE.id
}

export function resolveLeadConversionTemplateId(input: {
  projectType: ProjectType
  templateId?: string | null
}): string | null {
  const explicit = input.templateId ? parseProjectTemplateId(input.templateId) : null
  if (explicit) return explicit
  return defaultWebsiteTemplateIdForProjectType(input.projectType)
}
