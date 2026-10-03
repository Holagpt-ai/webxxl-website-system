'use client'

import { useState, useTransition } from 'react'
import { Info, Loader2 } from 'lucide-react'
import { signIn } from '@/lib/integrations/portal'
import { Button } from '@/components/ui/button'
import { TextField } from './fields'

type Labels = { email: string; password: string; submit: string; forgot: string; unavailable: string; invalid: string; requiredError: string }

export function LoginForm({ labels }: { labels: Labels }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!email || !password) return setMessage(labels.requiredError)
        startTransition(async () => {
          const result = await signIn({ email, password })
          if (result.ok) window.location.assign(result.redirectTo)
          else setMessage(result.reason === 'invalid' ? labels.invalid : labels.unavailable)
        })
      }}
    >
      <TextField id="login-email" type="email" label={labels.email} value={email} onChange={setEmail} autoComplete="email" required />
      <TextField id="login-password" type="password" label={labels.password} value={password} onChange={setPassword} autoComplete="current-password" required />
      {message && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="h-11">
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {labels.submit}
      </Button>
    </form>
  )
}
