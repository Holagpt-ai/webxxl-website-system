'use client'

import { useState, useTransition } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { submitLead } from '@/lib/integrations/forms'

type Labels = { placeholder: string; submit: string; success: string; error: string; emailLabel: string }

export function NewsletterForm({ locale, labels }: { locale: string; labels: Labels }) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [pending, startTransition] = useTransition()

  if (status === 'success') {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-inverse-foreground">
        <Check className="size-4 text-chart-2" aria-hidden="true" />
        {labels.success}
      </p>
    )
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(async () => {
          const result = await submitLead({
            email: String(data.get('email') ?? ''),
            website_url: String(data.get('website_url') ?? ''),
            source: 'footer-newsletter',
            locale,
          })
          setStatus(result.ok ? 'success' : 'error')
        })
      }}
    >
      <div className="flex rounded-lg border border-inverse-muted/30 bg-inverse-foreground/5 p-1 focus-within:ring-2 focus-within:ring-chart-2">
        <label htmlFor="newsletter-email" className="sr-only">
          {labels.emailLabel}
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={labels.placeholder}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-inverse-foreground placeholder:text-inverse-muted focus:outline-none"
        />
        <input type="text" name="website_url" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button
          type="submit"
          disabled={pending}
          aria-label={labels.submit}
          className="inline-flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      {status === 'error' && (
        <p role="alert" className="text-xs text-inverse-muted">
          {labels.error}
        </p>
      )}
    </form>
  )
}
