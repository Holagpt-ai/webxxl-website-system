'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CAPABILITY_DEFINITIONS } from '@/lib/managed-sites/capabilities'
import {
  approveManagedSiteChangeAction,
  createManagedSiteAction,
  setManagedSiteCapabilityAction,
  updateManagedSiteConnectionAction,
  updateManagedSiteProfileAction,
} from '@/lib/managed-sites/admin-actions'

export function CreateManagedSiteForm({
  customers,
  projects,
}: {
  customers: { id: string; businessName: string }[]
  projects: { id: string; name: string; customerAccountId: string }[]
}) {
  const [customerAccountId, setCustomerAccountId] = useState(customers[0]?.id ?? '')
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [canonicalUrl, setCanonicalUrl] = useState('https://')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const customerProjects = projects.filter((project) => project.customerAccountId === customerAccountId)
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          setError(null)
          const result = await createManagedSiteAction({
            customerAccountId,
            projectId: projectId || undefined,
            name,
            domain,
            canonicalUrl,
            status: 'SETUP',
            platform: 'OTHER',
          })
          if (!result.ok) {
            setError(result.error === 'duplicate_domain' ? 'That domain is already registered.' : result.error)
            return
          }
          setName('')
          setDomain('')
        })
      }}
    >
      <select className="rounded-md border bg-background px-3 py-2 text-sm" value={customerAccountId} onChange={(event) => setCustomerAccountId(event.target.value)} required>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.businessName}
          </option>
        ))}
      </select>
      <select className="rounded-md border bg-background px-3 py-2 text-sm" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
        <option value="">No project</option>
        {customerProjects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Site name" required />
      <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="example.com" required />
      <Input value={canonicalUrl} onChange={(event) => setCanonicalUrl(event.target.value)} placeholder="https://example.com/" required className="md:col-span-2" />
      {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
      <Button type="submit" disabled={pending || customers.length === 0} className="md:col-span-2">
        Register site
      </Button>
    </form>
  )
}

export function ManagedSiteProfileForm({
  siteId,
  name,
  status,
  platform,
  canonicalUrl,
  externalAdminUrl,
  projectId,
  projects,
}: {
  siteId: string
  name: string
  status: string
  platform: string
  canonicalUrl: string
  externalAdminUrl: string | null
  projectId: string | null
  projects: { id: string; name: string }[]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        startTransition(async () => {
          setError(null)
          const result = await updateManagedSiteProfileAction(siteId, {
            name: String(data.get('name') ?? ''),
            status: String(data.get('status') ?? ''),
            platform: String(data.get('platform') ?? ''),
            canonicalUrl: String(data.get('canonicalUrl') ?? ''),
            externalAdminUrl: String(data.get('externalAdminUrl') ?? ''),
            projectId: String(data.get('projectId') ?? '') || null,
          })
          if (!result.ok) setError(result.error)
        })
      }}
    >
      <Input name="name" defaultValue={name} required />
      <Input name="canonicalUrl" defaultValue={canonicalUrl} required />
      <Input name="externalAdminUrl" defaultValue={externalAdminUrl ?? ''} placeholder="Existing site admin URL" />
      <select name="status" defaultValue={status} className="rounded-md border bg-background px-3 py-2 text-sm">
        {['SETUP', 'ACTIVE', 'PAUSED', 'DISCONNECTED'].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <select name="platform" defaultValue={platform} className="rounded-md border bg-background px-3 py-2 text-sm">
        {['NEXTJS', 'WORDPRESS', 'CUSTOM', 'OTHER'].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <select name="projectId" defaultValue={projectId ?? ''} className="rounded-md border bg-background px-3 py-2 text-sm">
        <option value="">No project</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        Save site
      </Button>
    </form>
  )
}

export function ManagedSiteConnectionForm({
  siteId,
  adapterKey,
  connectionType,
  connectionRef,
}: {
  siteId: string
  adapterKey: string
  connectionType: string
  connectionRef: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        startTransition(async () => {
          setError(null)
          const result = await updateManagedSiteConnectionAction(
            siteId,
            String(data.get('adapterKey') ?? ''),
            String(data.get('connectionType') ?? ''),
            String(data.get('connectionRef') ?? ''),
          )
          if (!result.ok) setError(result.error === 'unauthorized' ? 'Only an admin can change the adapter or connection.' : result.error)
        })
      }}
    >
      <select name="adapterKey" defaultValue={adapterKey} className="rounded-md border bg-background px-3 py-2 text-sm">
        {['manual', 'abmed', 'webxxl-native', 'wordpress', 'custom-api'].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <select name="connectionType" defaultValue={connectionType} className="rounded-md border bg-background px-3 py-2 text-sm">
        {['MANUAL', 'EXTERNAL_ADMIN', 'API', 'WEBXXL_NATIVE'].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <Input name="connectionRef" defaultValue={connectionRef ?? ''} placeholder="Opaque connection reference" />
      <p className="text-xs text-muted-foreground">Store only a reference name. Do not paste tokens or passwords.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Save connection
      </Button>
    </form>
  )
}

export function ManagedSiteCapabilityForm({
  siteId,
  assignments,
}: {
  siteId: string
  assignments: { capabilityKey: string; enabled: boolean; executionMode: string | null }[]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <ul className="flex flex-col gap-3">
      {CAPABILITY_DEFINITIONS.map((definition) => {
        const current = assignments.find((item) => item.capabilityKey === definition.key)
        return (
          <li key={definition.key} className="rounded-lg border p-3 text-sm">
            <p className="font-medium">{definition.label.en}</p>
            <p className="text-xs text-muted-foreground">{definition.key}</p>
            <form
              className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                startTransition(async () => {
                  setError(null)
                  const result = await setManagedSiteCapabilityAction(
                    siteId,
                    definition.key,
                    data.get('enabled') === 'on',
                    String(data.get('executionMode') ?? ''),
                  )
                  if (!result.ok) setError(result.error)
                })
              }}
            >
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="enabled" defaultChecked={current?.enabled ?? false} />
                Enabled
              </label>
              <select name="executionMode" defaultValue={current?.executionMode ?? ''} className="rounded-md border bg-background px-2 py-1 text-xs">
                <option value="">Registry default</option>
                {['SELF_SERVICE', 'AI_ASSISTED', 'HUMAN_REQUIRED', 'READ_ONLY'].map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" variant="outline" disabled={pending}>
                Save
              </Button>
            </form>
          </li>
        )
      })}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </ul>
  )
}

export function ApproveSiteChangeButton({ changeId }: { changeId: string }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await approveManagedSiteChangeAction(changeId)
            if (!result.ok) {
              setMessage(result.error === 'unavailable' ? 'Approved. Live publish is not connected.' : result.error)
              return
            }
            setMessage(result.applied ? 'Applied' : 'Approved')
          })
        }
      >
        Approve
      </Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
