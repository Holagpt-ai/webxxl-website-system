import { prisma } from '@/lib/db'

/** Ensures a preview version belongs to the customer's project (current or historical). */
export async function assertPreviewVersionForProject(
  websitePreviewVersionId: string | null | undefined,
  projectId: string,
  customerAccountId: string,
): Promise<{ ok: true; versionId: string | null } | { ok: false; error: 'not_found' }> {
  if (!websitePreviewVersionId) return { ok: true, versionId: null }
  const version = await prisma.websitePreviewVersion.findUnique({
    where: { id: websitePreviewVersionId },
    include: { preview: true },
  })
  if (
    !version ||
    version.preview.projectId !== projectId ||
    version.preview.customerAccountId !== customerAccountId
  ) {
    return { ok: false, error: 'not_found' }
  }
  return { ok: true, versionId: version.id }
}
