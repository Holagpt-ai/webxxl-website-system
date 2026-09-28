'use client'

import { useRef, useState, useTransition } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { format } from '@/lib/i18n/localize'
import { submitProjectIntake } from '@/lib/integrations/forms'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChoiceGroup, Honeypot, SelectField, TextAreaField, TextField } from './fields'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STEP_KEYS = ['business', 'website', 'projectType', 'features', 'services', 'timeline', 'budget', 'contact', 'review'] as const
type StepKey = (typeof STEP_KEYS)[number]

type State = {
  businessName: string
  industry: string
  location: string
  hasWebsite: '' | 'yes' | 'no'
  websiteUrl: string
  websiteNotes: string
  projectType: string
  features: string[]
  services: string[]
  timeline: string
  budget: string
  name: string
  email: string
  phone: string
  notes: string
}

export type WizardLabels = {
  wizard: Dictionary['wizard']
  forms: Dictionary['forms']
  common: Dictionary['common']
}

export function ProjectWizard({
  locale,
  labels,
  industries,
  services,
  intent,
  plan,
  initialProjectType,
  initialIndustry,
}: {
  locale: string
  labels: WizardLabels
  industries: string[]
  services: string[]
  intent?: string
  plan?: string
  initialProjectType?: string
  initialIndustry?: string
}) {
  const { wizard: w, forms: f, common: c } = labels
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [honeypot, setHoneypot] = useState('')
  const [reference, setReference] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [s, setS] = useState<State>({
    businessName: '',
    industry: initialIndustry ?? '',
    location: '',
    hasWebsite: '',
    websiteUrl: '',
    websiteNotes: '',
    projectType: initialProjectType ?? '',
    features: [],
    services: [],
    timeline: '',
    budget: '',
    name: '',
    email: '',
    phone: '',
    notes: '',
  })

  const key: StepKey = STEP_KEYS[step]
  const total = STEP_KEYS.length
  const set = <K extends keyof State>(k: K) => (v: State[K]) => setS((prev) => ({ ...prev, [k]: v }))
  const toggle = (k: 'features' | 'services') => (option: string) =>
    setS((prev) => ({ ...prev, [k]: prev[k].includes(option) ? prev[k].filter((x) => x !== option) : [...prev[k], option] }))

  function validate(current: StepKey) {
    const next: Record<string, string> = {}
    if (current === 'business') {
      if (!s.businessName.trim()) next.businessName = f.requiredError
      if (!s.industry) next.industry = f.requiredError
    }
    if (current === 'contact') {
      if (!s.name.trim()) next.name = f.requiredError
      if (!EMAIL.test(s.email)) next.email = f.emailError
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function goTo(index: number) {
    setStep(index)
    requestAnimationFrame(() => headingRef.current?.focus())
  }

  function submit() {
    setFailed(false)
    startTransition(async () => {
      const result = await submitProjectIntake({
        locale,
        intent,
        plan,
        business: { name: s.businessName, industry: s.industry, location: s.location },
        currentWebsite: { hasWebsite: s.hasWebsite === 'yes', url: s.websiteUrl || undefined, notes: s.websiteNotes || undefined },
        projectType: s.projectType,
        features: s.features,
        services: s.services,
        timeline: s.timeline,
        budget: s.budget,
        contact: { name: s.name, email: s.email, phone: s.phone || undefined, notes: s.notes || undefined },
        website_url: honeypot,
      })
      if (result.ok) setReference(result.reference)
      else setFailed(true)
    })
  }

  if (reference) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-8 md:p-10">
        <CheckCircle2 className="size-10 text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-bold">{w.confirmationTitle}</h2>
        <p className="max-w-lg leading-relaxed text-muted-foreground">{w.confirmationBody}</p>
        <p className="rounded-lg bg-secondary px-4 py-2 font-mono text-sm text-secondary-foreground">
          {w.confirmationRef}: {reference}
        </p>
      </div>
    )
  }

  const listOrNone = (items: string[]) => (items.length ? items.join(', ') : w.nothingSelected)
  const review: { label: string; value: string; step: number }[] = [
    { label: w.steps.business.title, value: [s.businessName, s.industry, s.location].filter(Boolean).join(' · '), step: 0 },
    { label: w.steps.website.title, value: s.hasWebsite === 'yes' ? s.websiteUrl || w.fields.yes : s.hasWebsite === 'no' ? w.fields.no : w.nothingSelected, step: 1 },
    { label: w.steps.projectType.title, value: s.projectType || w.nothingSelected, step: 2 },
    { label: w.steps.features.title, value: listOrNone(s.features), step: 3 },
    { label: w.steps.services.title, value: listOrNone(s.services), step: 4 },
    { label: w.steps.timeline.title, value: s.timeline || w.nothingSelected, step: 5 },
    { label: w.steps.budget.title, value: s.budget || w.nothingSelected, step: 6 },
    { label: w.steps.contact.title, value: [s.name, s.email, s.phone].filter(Boolean).join(' · '), step: 7 },
  ]

  return (
    <div className="flex flex-col gap-6 rounded-2xl border bg-card p-6 md:p-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-primary" aria-live="polite">
          {format(w.stepOf, { current: step + 1, total })}
        </p>
        <div className="flex gap-1" aria-hidden="true">
          {STEP_KEYS.map((k, i) => (
            <span key={k} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {w.steps[key].title}
        </h2>
        <p className="text-muted-foreground">{w.steps[key].description}</p>
      </div>

      <form
        noValidate
        className="relative flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (key === 'review') return submit()
          if (validate(key)) goTo(step + 1)
        }}
      >
        {key === 'business' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField id="businessName" className="sm:col-span-2" label={w.fields.businessName} value={s.businessName} onChange={set('businessName')} autoComplete="organization" required error={errors.businessName} />
            <SelectField id="industry" label={w.fields.industry} value={s.industry} onChange={set('industry')} options={[...industries, w.fields.otherIndustry]} placeholder={f.selectPlaceholder} error={errors.industry} />
            <TextField id="location" label={w.fields.location} value={s.location} onChange={set('location')} optionalLabel={c.optional} />
          </div>
        )}

        {key === 'website' && (
          <div className="flex flex-col gap-5">
            <ChoiceGroup
              legend={w.fields.hasWebsite}
              options={[w.fields.yes, w.fields.no]}
              selected={s.hasWebsite === 'yes' ? [w.fields.yes] : s.hasWebsite === 'no' ? [w.fields.no] : []}
              onToggle={(o) => set('hasWebsite')(o === w.fields.yes ? 'yes' : 'no')}
            />
            <p className="-mt-2 text-sm text-muted-foreground">{w.fields.hasWebsite}</p>
            {s.hasWebsite === 'yes' && (
              <>
                <TextField id="websiteUrl" type="url" label={w.fields.websiteUrl} value={s.websiteUrl} onChange={set('websiteUrl')} autoComplete="url" optionalLabel={c.optional} />
                <TextAreaField id="websiteNotes" label={w.fields.websiteNotes} value={s.websiteNotes} onChange={set('websiteNotes')} optionalLabel={c.optional} />
              </>
            )}
          </div>
        )}

        {key === 'projectType' && (
          <ChoiceGroup legend={w.steps.projectType.title} options={w.projectTypes} selected={[s.projectType]} onToggle={set('projectType')} columns={3} />
        )}
        {key === 'features' && <ChoiceGroup legend={w.steps.features.title} options={w.features} selected={s.features} onToggle={toggle('features')} multiple />}
        {key === 'services' && <ChoiceGroup legend={w.steps.services.title} options={services} selected={s.services} onToggle={toggle('services')} multiple columns={3} />}
        {key === 'timeline' && <ChoiceGroup legend={w.steps.timeline.title} options={w.timelines} selected={[s.timeline]} onToggle={set('timeline')} />}
        {key === 'budget' && <ChoiceGroup legend={w.steps.budget.title} options={w.budgets} selected={[s.budget]} onToggle={set('budget')} />}

        {key === 'contact' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField id="name" label={f.name} value={s.name} onChange={set('name')} autoComplete="name" required error={errors.name} />
            <TextField id="email" type="email" label={f.email} value={s.email} onChange={set('email')} autoComplete="email" required error={errors.email} />
            <TextField id="phone" type="tel" label={f.phone} value={s.phone} onChange={set('phone')} autoComplete="tel" optionalLabel={c.optional} />
            <TextAreaField id="notes" className="sm:col-span-2" label={w.fields.notes} value={s.notes} onChange={set('notes')} optionalLabel={c.optional} />
          </div>
        )}

        {key === 'review' && (
          <dl className="flex flex-col divide-y rounded-xl border">
            {review.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 p-4">
                <div className="flex flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium">{row.value}</dd>
                </div>
                <button type="button" onClick={() => goTo(row.step)} className="text-sm font-semibold text-primary hover:underline">
                  {w.edit}
                  <span className="sr-only"> {row.label}</span>
                </button>
              </div>
            ))}
          </dl>
        )}

        <Honeypot value={honeypot} onChange={setHoneypot} />
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {f.errorBody}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t pt-6">
          <Button type="button" variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 0 || pending} className="h-11">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {w.back}
          </Button>
          <Button type="submit" size="lg" disabled={pending} className="h-11 px-6">
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {key === 'review' ? (pending ? w.submitting : w.submit) : w.continue}
            {key !== 'review' && <ArrowRight className="size-4" aria-hidden="true" />}
          </Button>
        </div>
      </form>
    </div>
  )
}
