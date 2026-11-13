import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getPlanActionHref } from '@/lib/integrations/billing'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getPlans } from '@/config/pricing'

describe('Batch 7C public conversion and responsive UI integration', () => {
  const getStarted = readFileSync(resolve('app/[locale]/get-started/page.tsx'), 'utf8')
  const pricingCards = readFileSync(resolve('components/blocks/pricing-cards.tsx'), 'utf8')
  const projectWizard = readFileSync(resolve('components/forms/project-wizard.tsx'), 'utf8')
  const contactForm = readFileSync(resolve('components/forms/contact-form.tsx'), 'utf8')

  it('pricing CTAs route through centralized getPlanActionHref with plan slug', () => {
    const plan = getPlans()[0]
    expect(getPlanActionHref(plan)).toMatch(/^\/get-started\?plan=/)
    expect(pricingCards).toContain('getPlanActionHref')
    expect(pricingCards).toContain('checkoutNote')
    expect(pricingCards).not.toMatch(/checkout succeeded|payment complete/i)
  })

  it('get-started preserves plan, intent, industry across project shortcut links', () => {
    expect(getStarted).toContain('presetHref')
    expect(getStarted).toContain("params.set('plan', query.plan)")
    expect(getStarted).toContain("params.set('intent', query.intent)")
    expect(getStarted).toContain("params.set('industry', query.industry)")
    expect(getStarted).toContain('plan={query.plan}')
    expect(getStarted).toContain('selectedPlan')
    expect(getStarted).toContain('quoteRequest')
  })

  it('project intake passes plan and preserves user input on failure', () => {
    expect(projectWizard).toContain('plan,')
    expect(projectWizard).toContain('submitProjectIntake')
    expect(projectWizard).toContain('keptValues')
    expect(projectWizard).toContain('setFailed(true)')
    expect(projectWizard).not.toContain('setS(empty')
  })

  it('contact form error recovery keeps values', () => {
    expect(contactForm).toContain("status === 'error'")
    expect(contactForm).toContain('keptValues')
    expect(contactForm).not.toContain('setValues(empty)')
  })

  it('EN/ES dictionaries include Batch 7C pricing and wizard copy', () => {
    const en = getDictionary('en')
    const es = getDictionary('es')
    expect(en.pricing.checkoutNote.length).toBeGreaterThan(0)
    expect(es.pricing.quoteTitle).toBeTruthy()
    expect(en.wizard.quoteRequest).toBeTruthy()
    expect(es.forms.keptValues).toBeTruthy()
  })

  it('responsive class adjustments on readiness and dashboard surfaces', () => {
    const files = [
      'components/dashboard/readiness-kit.tsx',
      'components/admin/operations-summary.tsx',
      'components/ai-employees/execution-readiness.tsx',
      'components/dashboard/marketplace-panel.tsx',
      'components/business/module-card.tsx',
    ]
    for (const file of files) {
      const source = readFileSync(resolve(file), 'utf8')
      expect(source).toMatch(/min-w-0|text-pretty|flex-wrap|sm:/)
    }
  })
})
