'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { MarketplaceServiceDefinition } from '@/lib/marketplace/catalog'
import { localizedMarketplaceText } from '@/lib/marketplace/catalog'
import {
  acquireMarketplaceSubmitLock,
  releaseMarketplaceSubmitLock,
  resolveMarketplaceServiceDisplayName,
  resolveServiceOrderStatusLabel,
  type MarketplaceOrderStatusLabels,
} from '@/lib/marketplace/display'
import { requestMarketplaceServiceAction } from '@/lib/marketplace/customer-actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export type MarketplaceRequestModalDict = {
  marketplaceRequestAddon: string
  marketplaceSelectProject: string
  marketplaceNotesLabel: string
  marketplaceNoPayment: string
  marketplaceSubmitRequest: string
  marketplaceCancel: string
  marketplaceDone: string
  marketplaceModalTitle: string
  marketplaceConfirmTitle: string
  marketplaceConfirmReference: string
  marketplaceConfirmStatus: string
  marketplaceConfirmFollowUp: string
  marketplaceConfirmService: string
  marketplaceComingSoon: string
  marketplaceUnavailable: string
  marketplaceDuplicateOrder: string
  marketplaceSubmitError: string
  marketplaceOrderStatusLabels: MarketplaceOrderStatusLabels
}

type SuccessState = {
  serviceKey: string
  publicId: string
  duplicate: boolean
}

export function MarketplaceRequestModal({
  locale,
  open,
  service,
  projects,
  dict,
  onOpenChange,
}: {
  locale: 'en' | 'es'
  open: boolean
  service: MarketplaceServiceDefinition | null
  projects: { id: string; name: string }[]
  dict: MarketplaceRequestModalDict
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const formId = useId()
  const errorId = `${formId}-error`
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessState | null>(null)
  const [pending, startTransition] = useTransition()
  const [submitLocked, setSubmitLocked] = useState(false)
  const submitGuardRef = useRef(false)

  useEffect(() => {
    if (!open || !service) return
    setProjectId('')
    setNotes('')
    setError(null)
    setSuccess(null)
    setSubmitLocked(false)
    submitGuardRef.current = false
  }, [open, service?.serviceKey])
  const serviceName = service ? localizedMarketplaceText(service.name, locale) : ''

  function closeModal() {
    if (pending) return
    setSubmitLocked(false)
    submitGuardRef.current = false
    onOpenChange(false)
  }

  function mapError(code: string): string {
    if (code === 'coming_soon') return dict.marketplaceComingSoon
    if (code === 'unavailable') return dict.marketplaceUnavailable
    if (code === 'project_required') return dict.marketplaceSelectProject
    if (code === 'unauthorized') return dict.marketplaceSubmitError
    return dict.marketplaceSubmitError
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!service || success) return
    const lock = acquireMarketplaceSubmitLock(submitGuardRef.current)
    if (!lock.allowed) return
    submitGuardRef.current = lock.nextLocked
    setSubmitLocked(true)
    setError(null)
    startTransition(async () => {
      try {
        const result = await requestMarketplaceServiceAction({
          serviceKey: service.serviceKey,
          projectId: projectId || undefined,
          customerNotes: notes,
        })
        if (!result.ok) {
          setError(mapError(result.error))
          submitGuardRef.current = releaseMarketplaceSubmitLock()
          setSubmitLocked(false)
          return
        }
        setSuccess({
          serviceKey: service.serviceKey,
          publicId: result.publicId,
          duplicate: result.duplicate,
        })
        router.refresh()
      } catch {
        setError(dict.marketplaceSubmitError)
        submitGuardRef.current = releaseMarketplaceSubmitLock()
        setSubmitLocked(false)
      }
    })
  }

  return (
    <Dialog
      open={open && Boolean(service)}
      onOpenChange={(next) => {
        if (!next) closeModal()
        else onOpenChange(true)
      }}
    >
      <DialogContent showCloseButton={!pending} aria-describedby={success ? undefined : error ? errorId : undefined}>
        {success ? (
          <>
            <DialogHeader>
              <DialogTitle>{dict.marketplaceConfirmTitle}</DialogTitle>
              <DialogDescription className="sr-only">{dict.marketplaceConfirmTitle}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm" role="status">
              <p className="text-base font-semibold text-foreground">{dict.marketplaceConfirmTitle}</p>
              <dl className="space-y-2">
                <div>
                  <dt className="text-muted-foreground">{dict.marketplaceConfirmService}</dt>
                  <dd className="font-medium">{resolveMarketplaceServiceDisplayName(success.serviceKey, locale)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{dict.marketplaceConfirmReference}</dt>
                  <dd className="font-mono text-sm">{success.publicId}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{dict.marketplaceConfirmStatus}</dt>
                  <dd>{resolveServiceOrderStatusLabel('REQUESTED', dict.marketplaceOrderStatusLabels, locale)}</dd>
                </div>
              </dl>
              <p className="text-muted-foreground">{dict.marketplaceNoPayment}</p>
              <p className="text-muted-foreground">{dict.marketplaceConfirmFollowUp}</p>
              {success.duplicate && <p className="text-muted-foreground">{dict.marketplaceDuplicateOrder}</p>}
            </div>
            <DialogFooter>
              <Button type="button" onClick={closeModal}>
                {dict.marketplaceDone}
              </Button>
            </DialogFooter>
          </>
        ) : (
          service && (
            <>
              <DialogHeader>
                <DialogTitle>{dict.marketplaceModalTitle}</DialogTitle>
                <DialogDescription>{serviceName}</DialogDescription>
              </DialogHeader>
              <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-base font-semibold">{serviceName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{localizedMarketplaceText(service.description, locale)}</p>
                </div>
                {service.requiresProject && (
                  <div>
                    <Label htmlFor={`${formId}-project`}>{dict.marketplaceSelectProject}</Label>
                    <select
                      id={`${formId}-project`}
                      className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      required
                      disabled={pending}
                    >
                      <option value="">—</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <Label htmlFor={`${formId}-notes`}>{dict.marketplaceNotesLabel}</Label>
                  <Textarea
                    id={`${formId}-notes`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    disabled={pending}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{dict.marketplaceNoPayment}</p>
                {error && (
                  <p id={errorId} className="text-sm font-medium text-destructive" role="alert">
                    {error}
                  </p>
                )}
              </form>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={pending} onClick={closeModal}>
                  {dict.marketplaceCancel}
                </Button>
                <Button type="submit" form={formId} disabled={pending || submitLocked}>
                  {dict.marketplaceSubmitRequest}
                </Button>
              </DialogFooter>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}
