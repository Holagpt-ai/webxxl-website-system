import { buttonVariants } from '@/components/ui/button'
import { EmptyState, SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { WebsitePreviewActions } from '@/components/dashboard/website-preview-actions'
import { enumLabel } from '@/lib/i18n/labels'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { previewDecisionIsBound } from '@/lib/website-preview/binding'
import { customerPreviewDeploymentUrl, isWebsiteProjectType } from '@/lib/website-preview/display'
import { findCustomerWebsitePreview } from '@/lib/website-preview/operations'
import { validatePreviewUrl, type WebsitePreviewProviderId } from '@/lib/website-preview/validation'

function fmtDate(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

export async function WebsitePreviewSection({
  customerAccountId,
  projectId,
  projectType,
  locale,
  copy,
}: {
  customerAccountId: string
  projectId: string
  projectType: string
  locale: string
  copy: Dictionary['dashboard']
}) {
  const preview = await findCustomerWebsitePreview(customerAccountId, projectId)
  if (!preview && !isWebsiteProjectType(projectType)) return null

  if (!preview || preview.versions.length === 0) {
    return (
      <div className="mb-6">
        <EmptyState title={copy.websitePreviewEmptyTitle} body={copy.websitePreviewEmptyBody} />
      </div>
    )
  }

  const version = preview.versions[0]
  const provider = preview.provider as WebsitePreviewProviderId
  const deploymentViewUrl = validatePreviewUrl(customerPreviewDeploymentUrl(version), provider)
  const publicAliasUrl = validatePreviewUrl(preview.aliasUrl, provider)
  const canDecide = Boolean(
    version.approval &&
      previewDecisionIsBound({
        version,
        approvalId: version.approval.id,
        approvalMetadata: version.approval.metadata,
      }),
  )
  const tone = version.status === 'APPROVED' ? 'success' : version.status === 'CHANGES_REQUESTED' ? 'warn' : 'default'

  return (
    <div className="mb-6">
      <SectionCard title={copy.websitePreviewTitle}>
        <div className="flex flex-col gap-4">
          {deploymentViewUrl.ok && (
            <iframe
              title={copy.previewFrameTitle}
              src={deploymentViewUrl.url}
              className="h-80 w-full rounded-lg border bg-background md:h-[28rem]"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            {deploymentViewUrl.ok && (
              <a className={buttonVariants()} href={deploymentViewUrl.url} target="_blank" rel="noopener noreferrer">
                {copy.openPreviewWebsite}
              </a>
            )}
            {publicAliasUrl.ok &&
              deploymentViewUrl.ok &&
              publicAliasUrl.url !== deploymentViewUrl.url && (
                <a
                  className={buttonVariants({ variant: 'outline' })}
                  href={publicAliasUrl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {copy.openPublicAlias}
                </a>
              )}
            <StatusBadge label={enumLabel(copy.websitePreviewStatuses, version.status)} tone={tone} />
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{copy.developmentStatus}</dt>
              <dd>{enumLabel(copy.websitePreviewStatuses, version.status)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.currentVersion}</dt>
              <dd>{version.versionLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.deploymentId}</dt>
              <dd className="break-all font-mono text-xs">{version.deploymentId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.lastUpdate}</dt>
              <dd>{fmtDate(version.updatedAt, locale)}</dd>
            </div>
            {version.sourceRevision && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{copy.sourceRevision}</dt>
                <dd className="break-all font-mono text-xs">{version.sourceRevision}</dd>
              </div>
            )}
          </dl>
          <p className="text-sm text-muted-foreground">{copy.previewBoundNote.replace('{deploymentId}', version.deploymentId)}</p>
          <WebsitePreviewActions
            versionId={version.id}
            canDecide={canDecide}
            approveLabel={copy.approveVersion}
            changesLabel={copy.requestChanges}
            notesPlaceholder={copy.optionalNotes}
            notesRequired={copy.previewNotesRequired}
            awaitingReview={copy.previewAwaitingReview}
            errors={{
              unauthorized: copy.previewUnauthorized,
              notFound: copy.previewNotFound,
              invalid: copy.previewInvalid,
              superseded: copy.previewSuperseded,
              failed: copy.previewActionFailed,
              notesRequired: copy.previewNotesRequired,
            }}
          />
        </div>
      </SectionCard>
    </div>
  )
}
