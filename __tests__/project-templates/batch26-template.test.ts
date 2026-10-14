import { describe, expect, it } from 'vitest'
import { STANDARD_BUSINESS_WEBSITE_TEMPLATE } from '@/lib/project-templates/standard-business-website'
import { getProjectTemplate, listProjectTemplates } from '@/lib/project-templates/registry'
import { templateWeightsAreValid, totalTemplateProgressWeight } from '@/lib/project-templates/weights'

describe('batch26 project templates', () => {
  it('lists the standard business website template', () => {
    expect(listProjectTemplates().map((t) => t.id)).toContain('standard-business-website')
    expect(getProjectTemplate('standard-business-website')?.version).toBe('1')
  })

  it('uses deterministic milestone weights totaling 100', () => {
    const template = STANDARD_BUSINESS_WEBSITE_TEMPLATE
    expect(template.milestones).toHaveLength(8)
    expect(templateWeightsAreValid(template)).toBe(true)
    expect(totalTemplateProgressWeight(template)).toBe(100)
  })

  it('defines reusable customer dependencies without tenant-specific ids', () => {
    const template = STANDARD_BUSINESS_WEBSITE_TEMPLATE
    for (const dep of template.dependencies) {
      expect(dep.title.length).toBeGreaterThan(3)
      expect(dep.customerActionKey).toMatch(/^(FILES|WEBSITE_REVIEW|APPROVALS)$/)
    }
    const serialized = JSON.stringify(template)
    expect(serialized.toLowerCase()).not.toContain('abmed')
  })
})
