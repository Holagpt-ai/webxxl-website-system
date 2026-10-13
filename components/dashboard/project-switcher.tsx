'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { switchCustomerProjectAction } from '@/lib/portal/customer-actions'

type ProjectOption = { id: string; name: string }

export function CustomerProjectSwitcher({
  projects,
  activeProjectId,
  label,
}: {
  projects: ProjectOption[]
  activeProjectId: string
  label: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (projects.length === 0) return null

  if (projects.length === 1) {
    return (
      <p className="truncate text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{label}: </span>
        {projects[0].name}
      </p>
    )
  }

  return (
    <div>
      <label htmlFor="customer-project-switch" className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id="customer-project-switch"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm font-medium"
        value={activeProjectId}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value
          if (next === activeProjectId) return
          startTransition(async () => {
            const result = await switchCustomerProjectAction(next)
            if (result.ok) router.refresh()
          })
        }}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  )
}
