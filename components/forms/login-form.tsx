'use client'

import { useState, useTransition } from 'react'
import { Info, Loader2 } from 'lucide-react'
import { requestMagicLinkAction } from '@/app/[locale]/login/actions'
import { Button } from '@/components/ui/button'
import { TextField } from './fields'

type Labels = {
  email: string
  submit: string
  unavailable: string
  requiredError: string
  magicLinkHint: string
  checkEmail: string
  emailRequired: string
}

export function LoginForm({ labels, callbackUrl }: { labels: Labels; callbackUrl: string }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!email) return setMessage(labels.emailRequired)
        startTransition(async () => {
          const result = await requestMagicLinkAction(email, callbackUrl)
          if (result.ok) {
            setSent(true)
            setMessage(labels.checkEmail)
          } else if (result.reason === 'not_configured') setMessage(labels.unavailable)
          else if (result.reason === 'invalid') setMessage(labels.emailRequired)
          else setMessage(labels.unavailable)
        })
      }}
    >
      <p className="text-sm text-muted-foreground">{labels.magicLinkHint}</p>
      <TextField
        id="login-email"
        type="email"
        label={labels.email}
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
      />
      {message && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending || sent} className="h-11">
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {labels.submit}
      </Button>
    </form>
  )
}
