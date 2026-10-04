'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { submitContact } from '@/lib/integrations/forms'
import { Button } from '@/components/ui/button'
import { Honeypot, SelectField, TextAreaField, TextField } from './fields'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Values = { name: string; email: string; phone: string; company: string; reason: string; service: string; message: string }
const empty: Values = { name: '', email: '', phone: '', company: '', reason: '', service: '', message: '' }

export function ContactForm({
  locale,
  labels,
  optionalLabel,
  services,
}: {
  locale: string
  labels: Dictionary['forms']
  optionalLabel: string
  services: string[]
}) {
  const [values, setValues] = useState<Values>(empty)
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({})
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'unavailable'>('idle')
  const [pending, startTransition] = useTransition()

  const set = (key: keyof Values) => (v: string) => setValues((prev) => ({ ...prev, [key]: v }))

  if (status === 'success') {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-2xl border bg-secondary p-8 text-secondary-foreground">
        <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
        <h3 className="text-xl font-bold">{labels.successTitle}</h3>
        <p className="leading-relaxed">{labels.successBody}</p>
      </div>
    )
  }

  function validate() {
    const next: typeof errors = {}
    if (!values.name.trim()) next.name = labels.requiredError
    if (!EMAIL.test(values.email)) next.email = labels.emailError
    if (!values.message.trim()) next.message = labels.requiredError
    setErrors(next)
    return Object.keys(next).length === 0
  }

  return (
    <form
      noValidate
      className="relative flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!validate()) return
        startTransition(async () => {
          const result = await submitContact({ ...values, locale, website_url: honeypot })
          setStatus(result.ok ? 'success' : result.error === 'unavailable' ? 'unavailable' : 'error')
        })
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="name" label={labels.name} value={values.name} onChange={set('name')} autoComplete="name" required error={errors.name} />
        <TextField id="email" type="email" label={labels.email} value={values.email} onChange={set('email')} autoComplete="email" required error={errors.email} />
        <TextField id="phone" type="tel" label={labels.phone} value={values.phone} onChange={set('phone')} autoComplete="tel" optionalLabel={optionalLabel} />
        <TextField id="company" label={labels.company} value={values.company} onChange={set('company')} autoComplete="organization" optionalLabel={optionalLabel} />
        <SelectField id="reason" label={labels.reason} value={values.reason} onChange={set('reason')} options={labels.reasons} placeholder={labels.selectPlaceholder} />
        <SelectField id="service" label={labels.service} value={values.service} onChange={set('service')} options={services} placeholder={labels.selectPlaceholder} />
      </div>
      <TextAreaField id="message" label={labels.message} value={values.message} onChange={set('message')} required error={errors.message} />
      <Honeypot value={honeypot} onChange={setHoneypot} />
      {status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {labels.errorBody}
        </p>
      )}
      {status === 'unavailable' && (
        <div role="alert" className="flex flex-col gap-1 rounded-lg border bg-muted p-4 text-sm">
          <p className="font-semibold">{labels.unavailableTitle}</p>
          <p className="leading-relaxed text-muted-foreground">{labels.unavailableBody}</p>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{labels.privacyNote}</p>
        <Button type="submit" size="lg" disabled={pending} className="h-11 px-6">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  )
}
