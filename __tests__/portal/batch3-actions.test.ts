import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_UPLOAD_BYTES } from '@/lib/files/policy'

const hoisted = vi.hoisted(() => {
  const uploadObject = vi.fn()
  const deleteObject = vi.fn()
  return {
    uploadObject,
    deleteObject,
    isStorageConfigured: vi.fn(),
    requireProjectAccess: vi.fn(),
    requireCustomerMembership: vi.fn(),
    requireStaff: vi.fn(),
    writeProjectActivity: vi.fn(async () => ({})),
    notifyStaffUsers: vi.fn(async () => undefined),
    notifyCustomerAccountMembers: vi.fn(async () => undefined),
    revalidatePath: vi.fn(),
    prisma: {
      project: { findUnique: vi.fn() },
      projectFile: {
        create: vi.fn(async () => ({ id: 'file-1' })),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        delete: vi.fn(async () => ({})),
      },
      projectFileLink: {
        findMany: vi.fn(async () => []),
        createMany: vi.fn(async () => ({ count: 1 })),
      },
      projectComment: { create: vi.fn(async () => ({})) },
      changeRequest: { create: vi.fn(async () => ({ id: 'cr-1' })) },
      supportRequest: { create: vi.fn(async () => ({ id: 'sr-1' })) },
      projectApproval: { findFirst: vi.fn() },
    },
  }
})

vi.mock('@/lib/db', () => ({ prisma: hoisted.prisma }))
vi.mock('next/cache', () => ({ revalidatePath: hoisted.revalidatePath }))
vi.mock('@/lib/portal/authz', () => ({
  requireProjectAccess: hoisted.requireProjectAccess,
  requireCustomerMembership: hoisted.requireCustomerMembership,
  requireStaff: hoisted.requireStaff,
}))
vi.mock('@/lib/portal/activity', () => ({
  writeProjectActivity: hoisted.writeProjectActivity,
  formatActivitySummary: (type: string, detail: string) => `${type}:${detail}`,
}))
vi.mock('@/lib/portal/notifications', () => ({
  notifyStaffUsers: hoisted.notifyStaffUsers,
}))
vi.mock('@/lib/admin/notify-customers', () => ({
  notifyCustomerAccountMembers: hoisted.notifyCustomerAccountMembers,
}))
vi.mock('@/lib/integrations/storage', () => ({
  isStorageConfigured: hoisted.isStorageConfigured,
  getStorageProvider: () => ({
    uploadObject: hoisted.uploadObject,
    deleteObject: hoisted.deleteObject,
  }),
}))

import { createSupportRequestAction, postCommentAction, submitChangeRequestAction, uploadProjectFileAction } from '@/lib/portal/actions'
import {
  attachApprovalFilesAction,
  deleteProjectFileAction,
  postStaffProjectCommentAction,
} from '@/lib/admin/actions'
import { uploadProjectFile, deleteStoredProjectFile, linkProjectFiles } from '@/lib/files/operations'

function pngUpload(name = 'logo.png', bytes = new Uint8Array([1, 2, 3, 4]), projectId = 'client-project') {
  const form = new FormData()
  form.set('projectId', projectId)
  form.set('category', 'PHOTO')
  form.set('storageKey', 'projects/evil/hack.exe')
  form.set('uploadedById', 'attacker')
  form.set('file', new File([bytes], name, { type: 'image/png' }))
  return form
}

beforeEach(() => {
  vi.clearAllMocks()
  hoisted.isStorageConfigured.mockReturnValue(true)
  hoisted.uploadObject.mockResolvedValue({ ok: true })
  hoisted.deleteObject.mockResolvedValue({ ok: true })
  hoisted.prisma.projectFileLink.findMany.mockResolvedValue([])
  hoisted.requireProjectAccess.mockResolvedValue({
    portal: { id: 'user-1', customerAccount: { id: 'acct-1' } },
    project: { id: 'proj-1', customerAccountId: 'acct-1' },
  })
  hoisted.requireCustomerMembership.mockResolvedValue({
    id: 'user-1',
    customerAccount: { id: 'acct-1' },
  })
  hoisted.requireStaff.mockResolvedValue({ id: 'staff-1', role: 'STAFF' })
  hoisted.prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', customerAccountId: 'acct-1' })
})

describe('customer file upload', () => {
  it('uploads to the authorized project with a server-side key and session uploader', async () => {
    const result = await uploadProjectFileAction(pngUpload())
    expect(result).toEqual({ ok: true })
    expect(hoisted.requireProjectAccess).toHaveBeenCalledWith('client-project')
    expect(hoisted.prisma.projectFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'proj-1',
        uploadedById: 'user-1',
        category: 'PHOTO',
        originalName: 'logo.png',
        storageKey: expect.stringMatching(
          /^projects\/proj-1\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-logo\.png$/,
        ),
      }),
    })
    expect(hoisted.notifyStaffUsers).toHaveBeenCalled()
  })

  it('does not upload to another account project when access is denied', async () => {
    hoisted.requireProjectAccess.mockRejectedValue(new Error('Project access denied'))
    const result = await uploadProjectFileAction(pngUpload('logo.png', new Uint8Array([1]), 'other-project'))
    expect(result).toEqual({ ok: false, error: 'unauthorized' })
    expect(hoisted.uploadObject).not.toHaveBeenCalled()
    expect(hoisted.prisma.projectFile.create).not.toHaveBeenCalled()
  })

  it('rejects an invalid MIME type before storage or database writes', async () => {
    const form = new FormData()
    form.set('projectId', 'proj-1')
    form.set('category', 'OTHER')
    form.set('file', new File(['<html></html>'], 'page.html', { type: 'text/html' }))
    const result = await uploadProjectFileAction(form)
    expect(result).toEqual({ ok: false, error: 'invalid' })
    expect(hoisted.uploadObject).not.toHaveBeenCalled()
    expect(hoisted.prisma.projectFile.create).not.toHaveBeenCalled()
  })

  it('rejects an oversized payload before storage', async () => {
    const result = await uploadProjectFile({
      actorUserId: 'user-1',
      projectId: 'proj-1',
      originalName: 'huge.png',
      mimeType: 'image/png',
      size: MAX_UPLOAD_BYTES + 1,
      bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1),
      category: 'PHOTO',
    })
    expect(result).toEqual({ ok: false, error: 'too_large' })
    expect(hoisted.uploadObject).not.toHaveBeenCalled()
    expect(hoisted.prisma.projectFile.create).not.toHaveBeenCalled()
  })

  it('returns storage-not-configured and does not persist a file', async () => {
    hoisted.isStorageConfigured.mockReturnValue(false)
    const result = await uploadProjectFileAction(pngUpload())
    expect(result).toEqual({ ok: false, error: 'not_configured' })
    expect(hoisted.uploadObject).not.toHaveBeenCalled()
    expect(hoisted.prisma.projectFile.create).not.toHaveBeenCalled()
  })
})

describe('project messages', () => {
  it('stores a customer message with the session author, project, and CUSTOMER visibility', async () => {
    const result = await postCommentAction('client-project', 'Hello team')
    expect(result).toEqual({ ok: true })
    expect(hoisted.prisma.projectComment.create).toHaveBeenCalledWith({
      data: {
        projectId: 'proj-1',
        authorUserId: 'user-1',
        body: 'Hello team',
        visibility: 'CUSTOMER',
      },
    })
  })

  it('lets staff post a customer-visible reply and notifies the account', async () => {
    const result = await postStaffProjectCommentAction('proj-1', 'We received the logo', 'CUSTOMER')
    expect(result).toEqual({ ok: true })
    expect(hoisted.prisma.projectComment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'proj-1',
        authorUserId: 'staff-1',
        visibility: 'CUSTOMER',
      }),
    })
    expect(hoisted.notifyCustomerAccountMembers).toHaveBeenCalled()
  })

  it('lets staff post an internal note without notifying the customer', async () => {
    const result = await postStaffProjectCommentAction('proj-1', 'Call them tomorrow', 'INTERNAL')
    expect(result).toEqual({ ok: true })
    expect(hoisted.prisma.projectComment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ visibility: 'INTERNAL', authorUserId: 'staff-1', projectId: 'proj-1' }),
    })
    expect(hoisted.notifyCustomerAccountMembers).not.toHaveBeenCalled()
  })
})

describe('workflow attachments stay on the same project', () => {
  beforeEach(() => {
    hoisted.prisma.projectFile.findMany.mockResolvedValue([{ id: 'file-other', projectId: 'proj-other' }])
  })

  it('blocks approval links to a file from another project', async () => {
    hoisted.prisma.projectApproval.findFirst.mockResolvedValue({ id: 'ap-1', projectId: 'proj-1', title: 'Homepage' })
    const result = await attachApprovalFilesAction('proj-1', 'ap-1', ['file-other'])
    expect(result).toEqual({ ok: false, error: 'cross_project' })
    expect(hoisted.prisma.projectFileLink.createMany).not.toHaveBeenCalled()
  })

  it('blocks change-request links to a file from another project', async () => {
    const result = await submitChangeRequestAction('proj-1', 'New page', 'Add a gallery', 'NORMAL', ['file-other'])
    expect(result).toEqual({ ok: false, error: 'cross_project' })
    expect(hoisted.prisma.changeRequest.create).not.toHaveBeenCalled()
    expect(hoisted.prisma.projectFileLink.createMany).not.toHaveBeenCalled()
  })

  it('blocks support links to a file from another project', async () => {
    const result = await createSupportRequestAction('Help', 'See attached', 'proj-1', ['file-other'])
    expect(result).toEqual({ ok: false, error: 'cross_project' })
    expect(hoisted.prisma.supportRequest.create).not.toHaveBeenCalled()
  })

  it('rejects each link helper target independently', async () => {
    await expect(linkProjectFiles({ targetProjectId: 'proj-1', fileIds: ['file-other'], approvalId: 'ap-1' })).resolves.toEqual({
      ok: false,
      error: 'cross_project',
    })
    await expect(
      linkProjectFiles({ targetProjectId: 'proj-1', fileIds: ['file-other'], changeRequestId: 'cr-1' }),
    ).resolves.toEqual({ ok: false, error: 'cross_project' })
    await expect(
      linkProjectFiles({ targetProjectId: 'proj-1', fileIds: ['file-other'], supportRequestId: 'sr-1' }),
    ).resolves.toEqual({ ok: false, error: 'cross_project' })
  })
})

describe('file deletion', () => {
  const stored = {
    id: 'file-1',
    projectId: 'proj-1',
    storageKey: 'projects/proj-1/logo.png',
    originalName: 'logo.png',
  }

  it('refuses customers and does not touch storage', async () => {
    hoisted.requireStaff.mockRejectedValue(new Error('Staff access required'))
    const result = await deleteProjectFileAction('proj-1', 'file-1')
    expect(result).toEqual({ ok: false, error: 'unauthorized' })
    expect(hoisted.deleteObject).not.toHaveBeenCalled()
    expect(hoisted.prisma.projectFile.delete).not.toHaveBeenCalled()
  })

  it('refuses a non-staff role even if the staff gate is bypassed', async () => {
    hoisted.requireStaff.mockResolvedValue({ id: 'user-1', role: 'CUSTOMER' })
    const result = await deleteProjectFileAction('proj-1', 'file-1')
    expect(result).toEqual({ ok: false, error: 'unauthorized' })
    expect(hoisted.deleteObject).not.toHaveBeenCalled()
  })

  it('keeps the database row when storage deletion fails', async () => {
    hoisted.prisma.projectFile.findFirst.mockResolvedValue(stored)
    hoisted.deleteObject.mockResolvedValue({ ok: false, reason: 'failed' })
    const result = await deleteStoredProjectFile({ actorUserId: 'staff-1', projectId: 'proj-1', fileId: 'file-1' })
    expect(result).toEqual({ ok: false, error: 'failed' })
    expect(hoisted.prisma.projectFile.delete).not.toHaveBeenCalled()
  })

  it('keeps the database row when storage is not configured', async () => {
    hoisted.isStorageConfigured.mockReturnValue(false)
    hoisted.prisma.projectFile.findFirst.mockResolvedValue(stored)
    const result = await deleteStoredProjectFile({ actorUserId: 'staff-1', projectId: 'proj-1', fileId: 'file-1' })
    expect(result).toEqual({ ok: false, error: 'not_configured' })
    expect(hoisted.deleteObject).not.toHaveBeenCalled()
    expect(hoisted.prisma.projectFile.delete).not.toHaveBeenCalled()
  })

  it('deletes the storage object before the database row', async () => {
    const order: string[] = []
    hoisted.prisma.projectFile.findFirst.mockResolvedValue(stored)
    hoisted.deleteObject.mockImplementation(async () => {
      order.push('storage')
      return { ok: true }
    })
    hoisted.prisma.projectFile.delete.mockImplementation(async () => {
      order.push('db')
      return {}
    })
    const result = await deleteProjectFileAction('proj-1', 'file-1')
    expect(result).toEqual({ ok: true })
    expect(order).toEqual(['storage', 'db'])
    expect(hoisted.deleteObject).toHaveBeenCalledWith('projects/proj-1/logo.png')
    expect(hoisted.writeProjectActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'FILE_DELETED', projectId: 'proj-1', actorUserId: 'staff-1' }),
    )
  })
})
