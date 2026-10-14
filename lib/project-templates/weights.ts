import type { ProjectTemplateDefinition } from '@/lib/project-templates/types'

export function totalTemplateProgressWeight(template: ProjectTemplateDefinition): number {
  return template.milestones.reduce((sum, m) => sum + m.progressWeight, 0)
}

export function templateWeightsAreValid(template: ProjectTemplateDefinition): boolean {
  if (template.milestones.length === 0) return false
  return template.milestones.every((m) => m.progressWeight > 0 && Number.isInteger(m.progressWeight))
}
