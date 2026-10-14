'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAdminCopy } from '@/components/admin/locale'
import { abmedClinicalResearchRegistration } from '@/lib/website-preview/catalog'
import { STAFF_PREVIEW_STATUSES, WEBSITE_PREVIEW_PROVIDERS } from '@/lib/website-preview/providers'
import { registerWebsitePreviewAction } from '@/lib/website-preview/actions'
import { enumLabel } from '@/lib/i18n/labels'

const initial = {
  provider: 'VERCEL',
  displayName: '',
  aliasUrl: '',
  registeredUrl: '',
  deploymentId: '',
  versionLabel: '',
  sourceRevision: '',
  status: 'READY_FOR_REVIEW',
}

export function WebsitePreviewForm({ projectId }: { projectId: string }) {
  const router = useRouter()
  const { admin, dashboard } = useAdminCopy()
  const copy = admin.websitePreview
  const [fields, setFields] = useState(initial)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function set<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setFields((current) => ({ ...current, [key]: value }))
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        setMessage(null)
        startTransition(async () => {
          const result = await registerWebsitePreviewAction(
            projectId,
            fields.provider,
            fields.displayName,
            fields.aliasUrl,
            fields.registeredUrl,
            fields.deploymentId,
            fields.versionLabel,
            fields.sourceRevision,
            fields.status,
          )
          if (!result.ok) {
            const errors = copy.errors as Record<string, string>
            setMessage(errors[result.error] ?? copy.errors.failed)
            return
          }
          setMessage(copy.saved)
          router.refresh()
        })
      }}
    >
      <p className="text-sm text-muted-foreground">{copy.description}</p>
      <details className="rounded-md border bg-muted/30 p-3 text-sm">
        <summary className="cursor-pointer font-medium">{copy.legacyCatalog}</summary>
        <p className="mt-2 text-muted-foreground">{copy.legacyCatalogHelp}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-2"
          onClick={() => {
            const verified = abmedClinicalResearchRegistration()
            setFields({
              provider: verified.provider,
              displayName: verified.displayName,
              aliasUrl: verified.aliasUrl,
              registeredUrl: verified.registeredUrl,
              deploymentId: verified.deploymentId,
              versionLabel: verified.versionLabel,
              sourceRevision: verified.sourceRevision,
              status: verified.status,
            })
            setMessage(copy.abmedGuard)
          }}
        >
          {copy.fillAbmed}
        </Button>
      </details>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="preview-provider">{copy.provider}</Label>
          <select
            id="preview-provider"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={fields.provider}
            onChange={(event) => set('provider', event.target.value)}
          >
            {WEBSITE_PREVIEW_PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {enumLabel(dashboard.previewProviders, provider)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="preview-status">{copy.status}</Label>
          <select
            id="preview-status"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={fields.status}
            onChange={(event) => set('status', event.target.value)}
          >
            {STAFF_PREVIEW_STATUSES.map((status) => (
              <option key={status} value={status}>
                {enumLabel(dashboard.websitePreviewStatuses, status)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="preview-name">{copy.displayName}</Label>
        <Input id="preview-name" className="mt-1" value={fields.displayName} onChange={(event) => set('displayName', event.target.value)} required />
      </div>
      <div>
        <Label htmlFor="preview-registered-url">{copy.registeredUrl}</Label>
        <Input
          id="preview-registered-url"
          className="mt-1"
          value={fields.registeredUrl}
          onChange={(event) => set('registeredUrl', event.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="preview-url">{copy.aliasUrl}</Label>
        <Input id="preview-url" className="mt-1" value={fields.aliasUrl} onChange={(event) => set('aliasUrl', event.target.value)} required />
      </div>
      <div>
        <Label htmlFor="preview-deployment">{copy.deploymentId}</Label>
        <Input
          id="preview-deployment"
          className="mt-1"
          value={fields.deploymentId}
          onChange={(event) => set('deploymentId', event.target.value)}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="preview-version">{copy.versionLabel}</Label>
          <Input
            id="preview-version"
            className="mt-1"
            value={fields.versionLabel}
            onChange={(event) => set('versionLabel', event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="preview-revision">{copy.sourceRevision}</Label>
          <Input
            id="preview-revision"
            className="mt-1"
            value={fields.sourceRevision}
            onChange={(event) => set('sourceRevision', event.target.value)}
          />
        </div>
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <Button type="submit" disabled={pending}>
        {copy.register}
      </Button>
    </form>
  )
}
