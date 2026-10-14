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
