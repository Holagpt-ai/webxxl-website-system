'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { respondApprovalAction, submitChangeRequestAction } from '@/lib/portal/actions'
import { previewDecisionIsBound } from '@/lib/website-preview/binding'
import { previewChangeRequestDescription, previewChangeRequestTitle } from '@/lib/website-preview/display'

export type WebsitePreviewCustomerResult = { ok: true } | { ok: false; error: string }

async function currentVersionForCustomer(versionId: string) {
  const portal = await requireCustomerMembership()
  const version = await prisma.websitePreviewVersion.findUnique({
    where: { id: versionId },
    include: { preview: true, approval: true },
  })
  if (!version || !version.isCurrent || version.preview.customerAccountId !== portal.customerAccount.id) {
    return { ok: false as const, error: 'not_found' }
  }
  return { ok: true as const, portal, version }
}

export async function approveWebsitePreviewVersionAction(
  versionId: string,
  notes: string,
): Promise<WebsitePreviewCustomerResult> {
  try {
    const access = await currentVersionForCustomer(versionId)
    if (!access.ok) return access
    const approval = access.version.approval
    if (
      !approval ||
      !previewDecisionIsBound({
        version: access.version,
        approvalId: approval.id,
        approvalMetadata: approval.metadata,
      })
    ) {
      return { ok: false, error: 'not_found' }
    }
    return respondApprovalAction(approval.id, 'APPROVED', notes)
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function requestWebsitePreviewChangesAction(
  versionId: string,
  notes: string,
): Promise<WebsitePreviewCustomerResult> {
  try {
    const access = await currentVersionForCustomer(versionId)
    if (!access.ok) return access
    const description = notes.trim()
    if (!description) return { ok: false, error: 'notes_required' }

    const approval = access.version.approval
    if (
      approval &&
      previewDecisionIsBound({
        version: access.version,
        approvalId: approval.id,
        approvalMetadata: approval.metadata,
      })
    ) {
      return respondApprovalAction(approval.id, 'CHANGES_REQUESTED', description)
    }

    const title = previewChangeRequestTitle(access.portal.preferredLocale, access.version.versionLabel)
    return submitChangeRequestAction(
      access.version.preview.projectId,
      title,
      previewChangeRequestDescription(description, access.version.deploymentId),
      'NORMAL',
      [],
      { category: 'OTHER', websitePreviewVersionId: access.version.id },
    )
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
