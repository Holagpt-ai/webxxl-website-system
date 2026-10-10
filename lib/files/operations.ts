import { prisma } from '@/lib/db'
import { formatActivitySummary, writeProjectActivity } from '@/lib/portal/activity'
import { canAttachFileToProject } from '@/lib/files/access'
import { buildStorageKey, parseFileCategory, sanitizeOriginalName, validateUploadFile } from '@/lib/files/policy'
import { getStorageProvider, isStorageConfigured, type StorageDeleteResult } from '@/lib/integrations/storage'
import type { ProjectFileCategory } from '@prisma/client'

export type FileOpResult = { ok: true; fileId?: string } | { ok: false; error: string }

/** Database row is removed only after the storage object is gone (or was already missing). */
export function shouldRemoveDatabaseRecord(storageDelete: StorageDeleteResult): boolean {
  return storageDelete.ok
}

export async function uploadProjectFile(input: {
  actorUserId: string
  projectId: string
  originalName: string
  mimeType: string
  size: number
  bytes: Uint8Array
  category: ProjectFileCategory
}): Promise<FileOpResult> {
  const validation = validateUploadFile(input.originalName, input.mimeType, input.bytes.byteLength)
  if (validation !== 'ok') return { ok: false, error: validation }
  if (!isStorageConfigured()) return { ok: false, error: 'not_configured' }

  const originalName = sanitizeOriginalName(input.originalName)
  const storageKey = buildStorageKey(input.projectId, originalName)
  const provider = getStorageProvider()
  const uploaded = await provider.uploadObject({
    storageKey,
    originalName,
    mimeType: input.mimeType,
    size: input.bytes.byteLength,
    body: input.bytes,
  })
  if (!uploaded.ok) return { ok: false, error: uploaded.reason }

  try {
    const file = await prisma.projectFile.create({
      data: {
        projectId: input.projectId,
        uploadedById: input.actorUserId,
        originalName,
        storageKey,
        mimeType: input.mimeType,
        size: input.bytes.byteLength,
        category: input.category,
      },
    })
    await writeProjectActivity({
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      eventType: 'FILE_UPLOADED',
      summary: formatActivitySummary('FILE_UPLOADED', originalName),
    })
    return { ok: true, fileId: file.id }
  } catch (error) {
    await provider.deleteObject(storageKey)
    throw error
  }
}

export async function deleteStoredProjectFile(input: {
  actorUserId: string
  projectId: string
  fileId: string
}): Promise<FileOpResult> {
  const file = await prisma.projectFile.findFirst({
    where: { id: input.fileId, projectId: input.projectId },
  })
  if (!file) return { ok: false, error: 'not_found' }
  if (!isStorageConfigured()) return { ok: false, error: 'not_configured' }

  const provider = getStorageProvider()
  const removed = await provider.deleteObject(file.storageKey)
  if (!removed.ok) return { ok: false, error: removed.reason }
  if (!shouldRemoveDatabaseRecord(removed)) return { ok: false, error: 'failed' }

  await prisma.projectFile.delete({ where: { id: file.id } })
  await writeProjectActivity({
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    eventType: 'FILE_DELETED',
    summary: formatActivitySummary('FILE_DELETED', file.originalName),
  })
  return { ok: true }
}

export async function assertFilesBelongToProject(fileIds: string[], projectId: string): Promise<FileOpResult> {
  const ids = uniqueIds(fileIds)
  if (ids.length === 0) return { ok: true }
  if (!projectId) return { ok: false, error: 'cross_project' }
  const files = await prisma.projectFile.findMany({
    where: { id: { in: ids } },
    select: { id: true, projectId: true },
  })
  if (files.length !== ids.length) return { ok: false, error: 'not_found' }
  if (files.some((file) => !canAttachFileToProject(file.projectId, projectId))) {
    return { ok: false, error: 'cross_project' }
  }
  return { ok: true }
}

export async function linkProjectFiles(input: {
  targetProjectId: string
  fileIds: string[]
  approvalId?: string
  changeRequestId?: string
  supportRequestId?: string
}): Promise<FileOpResult> {
  const parents = [input.approvalId, input.changeRequestId, input.supportRequestId].filter(Boolean)
  if (parents.length !== 1) return { ok: false, error: 'invalid' }
  const ids = uniqueIds(input.fileIds)
  if (ids.length === 0) return { ok: true }

  const allowed = await assertFilesBelongToProject(ids, input.targetProjectId)
  if (!allowed.ok) return allowed

  const existing = await prisma.projectFileLink.findMany({
    where: {
      projectFileId: { in: ids },
      approvalId: input.approvalId ?? null,
      changeRequestId: input.changeRequestId ?? null,
      supportRequestId: input.supportRequestId ?? null,
    },
    select: { projectFileId: true },
  })
  const linked = new Set(existing.map((row) => row.projectFileId))
  const toCreate = ids.filter((id) => !linked.has(id))
  if (toCreate.length === 0) return { ok: true }

  await prisma.projectFileLink.createMany({
    data: toCreate.map((projectFileId) => ({
      projectFileId,
      approvalId: input.approvalId ?? null,
      changeRequestId: input.changeRequestId ?? null,
      supportRequestId: input.supportRequestId ?? null,
    })),
  })
  return { ok: true }
}

export async function readUploadFromFormData(formData: FormData): Promise<
  | {
      ok: true
      projectId: string
      category: ProjectFileCategory
      originalName: string
      mimeType: string
      size: number
      bytes: Uint8Array
    }
  | { ok: false; error: string }
> {
  const projectId = String(formData.get('projectId') ?? '')
  const category = parseFileCategory(formData.get('category'))
  if (!category) return { ok: false, error: 'invalid' }
  const entry = formData.get('file')
  if (!entry || typeof entry === 'string' || typeof entry.arrayBuffer !== 'function') {
    return { ok: false, error: 'invalid' }
  }
  const size = entry.size
  const validation = validateUploadFile(entry.name, entry.type, size)
  if (validation !== 'ok') return { ok: false, error: validation }
  const bytes = new Uint8Array(await entry.arrayBuffer())
  const byteValidation = validateUploadFile(entry.name, entry.type, bytes.byteLength)
  if (byteValidation !== 'ok') return { ok: false, error: byteValidation }
  return {
    ok: true,
    projectId,
    category,
    originalName: entry.name,
    mimeType: entry.type,
    size: bytes.byteLength,
    bytes,
  }
}

function uniqueIds(fileIds: string[]): string[] {
  return [...new Set(fileIds.map((id) => id.trim()).filter(Boolean))]
}
