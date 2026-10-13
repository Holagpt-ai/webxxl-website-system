'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireStaff } from '@/lib/portal/authz'
import { registerWebsitePreview } from '@/lib/website-preview/operations'

export type WebsitePreviewActionResult = { ok: true } | { ok: false; error: string }

function revalidatePreviewPaths() {
  revalidatePath('/admin', 'layout')
  revalidatePath('/es/admin', 'layout')
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/es/dashboard', 'layout')
}

export async function registerWebsitePreviewAction(
  projectId: string,
  provider: string,
  displayName: string,
  aliasUrl: string,
  deploymentId: string,
  versionLabel: string,
  sourceRevision: string,
  status: string,
): Promise<WebsitePreviewActionResult> {
  try {
    const staff = await requireStaff()
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, customerAccountId: true },
    })
    if (!project) return { ok: false, error: 'not_found' }
    const result = await registerWebsitePreview({
      actorUserId: staff.id,
      project,
      provider,
      displayName,
      aliasUrl,
      deploymentId,
      versionLabel,
      sourceRevision,
      status,
    })
    if (!result.ok) return result
    revalidatePreviewPaths()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
