'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { aiBase, aiMutate, type AiEmployee, type AiErrorCode } from '@/lib/ai-employees-ui/client'
import { AiState, Field } from './ui'
import { LocalePicker } from './locale-picker'
import type { WorkforceContext } from './workforce-view'

export function CreateEmployeeDialog({
  open,
  onOpenChange,
  ctx,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ctx: WorkforceContext
  onCreated: (employee: AiEmployee) => void
}) {
  const { copy, accountId } = ctx
  const [displayName, setDisplayName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [description, setDescription] = useState('')
  const [primaryLocale, setPrimaryLocale] = useState(ctx.locale === 'es' ? 'es' : 'en')
  const [secondaryLocales, setSecondaryLocales] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<{ code: AiErrorCode; detail?: string } | null>(null)

  const reset = () => {
    setDisplayName('')
    setRoleTitle('')
    setDescription('')
    setSecondaryLocales([])
    setFailure(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!displayName.trim() || !roleTitle.trim()) {
      setFailure({ code: 'VALIDATION', detail: copy.form.required })
      return
    }
    setPending(true)
    setFailure(null)
    const result = await aiMutate<AiEmployee>(`${aiBase(accountId)}/employees`, 'POST', {
      displayName: displayName.trim(),
      roleTitle: roleTitle.trim(),
      description: description.trim() || null,
      primaryLocale,
      secondaryLocales: secondaryLocales.filter((tag) => tag !== primaryLocale),
    })
    setPending(false)
    if (!result.ok) {
      setFailure({ code: result.code, detail: result.detail })
      return
    }
    reset()
    onOpenChange(false)
    onCreated(result.data)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.form.createTitle}</DialogTitle>
          <DialogDescription>{copy.form.createDescription}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field id="ai-create-name" label={copy.form.name}>
            <Input id="ai-create-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={copy.form.namePlaceholder} required maxLength={120} />
          </Field>
          <Field id="ai-create-role" label={copy.form.role}>
            <Input id="ai-create-role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder={copy.form.rolePlaceholder} required maxLength={120} />
          </Field>
          <Field id="ai-create-description" label={copy.form.description}>
            <Textarea id="ai-create-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={copy.form.descriptionPlaceholder} rows={3} maxLength={1000} />
          </Field>
          <LocalePicker
            idPrefix="ai-create"
            copy={copy}
            primary={primaryLocale}
            secondary={secondaryLocales}
            onPrimaryChange={setPrimaryLocale}
            onSecondaryChange={setSecondaryLocales}
          />
          {failure && <AiState compact code={failure.code} detail={failure.detail} copy={copy} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {copy.common.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? copy.common.saving : copy.form.submitCreate}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
