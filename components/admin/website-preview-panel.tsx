import { WebsitePreviewForm } from '@/components/admin/website-preview-form'
import { SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { enumLabel } from '@/lib/i18n/labels'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { findStaffWebsitePreview } from '@/lib/website-preview/operations'

export async function WebsitePreviewAdminPanel({
  projectId,
  locale,
  admin,
  dashboard,
}: {
  projectId: string
  locale: string
  admin: Dictionary['admin']
  dashboard: Dictionary['dashboard']
}) {
  const preview = await findStaffWebsitePreview(projectId)
  const copy = admin.websitePreview
  const current = preview?.versions.find((version) => version.isCurrent) ?? null
  const earlier = preview?.versions.filter((version) => !version.isCurrent) ?? []
  const fmt = (value: Date) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(value)

  return (
    <SectionCard title={copy.title}>
      <WebsitePreviewForm projectId={projectId} />
      {!current ? (
        <p className="mt-4 text-sm text-muted-foreground">{copy.none}</p>
      ) : (
        <div className="mt-4 text-sm">
          <p className="font-medium">{copy.current}</p>
          <p className="mt-1">
            {current.versionLabel} · <span className="font-mono text-xs">{current.deploymentId}</span>
          </p>
          <p className="text-muted-foreground">
            {copy.registeredUrl}: {current.registeredUrl}
          </p>
          {preview && (
            <p className="text-muted-foreground">
              {copy.aliasUrl}: {preview.aliasUrl}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge label={enumLabel(dashboard.websitePreviewStatuses, current.status)} />
            <span className="text-muted-foreground">{fmt(current.updatedAt)}</span>
          </div>
        </div>
      )}
      {earlier.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium">{copy.history}</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {earlier.map((version) => (
              <li key={version.id}>
                {version.versionLabel} · <span className="font-mono text-xs">{version.deploymentId}</span> ·{' '}
                {enumLabel(dashboard.websitePreviewStatuses, version.status)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  )
}
