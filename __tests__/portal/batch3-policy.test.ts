import { afterEach, describe, expect, it } from 'vitest'
import { filterCustomerComments } from '@/lib/portal/access-rules'
import {
  canAttachFileToProject,
  canCustomerAccessProjectFile,
  canDeleteProjectFile,
  parseStaffCommentVisibility,
} from '@/lib/files/access'
import { buildCustomerCommentWrite, buildStaffCommentWrite } from '@/lib/files/comments'
import { MAX_UPLOAD_BYTES, buildStorageKey, validateUploadFile } from '@/lib/files/policy'
import { shouldRemoveDatabaseRecord } from '@/lib/files/operations'
import {
  getStorageProvider,
  isStorageConfigured,
  resetStorageProviderForTests,
  resolveSignedStorageUrl,
} from '@/lib/integrations/storage'

const envSnapshot = {
  url: process.env.STORAGE_SUPABASE_URL,
  key: process.env.STORAGE_SUPABASE_SERVICE_KEY,
  bucket: process.env.STORAGE_BUCKET,
}

afterEach(() => {
  if (envSnapshot.url === undefined) delete process.env.STORAGE_SUPABASE_URL
  else process.env.STORAGE_SUPABASE_URL = envSnapshot.url
  if (envSnapshot.key === undefined) delete process.env.STORAGE_SUPABASE_SERVICE_KEY
  else process.env.STORAGE_SUPABASE_SERVICE_KEY = envSnapshot.key
  if (envSnapshot.bucket === undefined) delete process.env.STORAGE_BUCKET
  else process.env.STORAGE_BUCKET = envSnapshot.bucket
  resetStorageProviderForTests()
})

describe('file validation policy', () => {
  it('accepts practical website project files', () => {
    expect(validateUploadFile('logo.png', 'image/png', 1200)).toBe('ok')
    expect(validateUploadFile('brief.pdf', 'application/pdf', 1200)).toBe('ok')
    expect(validateUploadFile('copy.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1200)).toBe('ok')
    expect(validateUploadFile('sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 1200)).toBe('ok')
    expect(validateUploadFile('assets.zip', 'application/zip', 1200)).toBe('ok')
  })

  it('rejects unsupported and executable types', () => {
    expect(validateUploadFile('page.html', 'text/html', 100)).toBe('invalid')
    expect(validateUploadFile('app.js', 'text/javascript', 100)).toBe('invalid')
    expect(validateUploadFile('logo.svg', 'image/svg+xml', 100)).toBe('invalid')
    expect(validateUploadFile('setup.exe', 'application/octet-stream', 100)).toBe('invalid')
    expect(validateUploadFile('notes.txt', 'application/x-msdownload', 100)).toBe('invalid')
    expect(validateUploadFile('logo.png', 'text/html', 100)).toBe('invalid')
  })

  it('rejects oversized files', () => {
    expect(validateUploadFile('logo.png', 'image/png', MAX_UPLOAD_BYTES + 1)).toBe('too_large')
    expect(validateUploadFile('logo.png', 'image/png', MAX_UPLOAD_BYTES)).toBe('ok')
  })

  it('builds a server-side key and ignores path traversal in the filename', () => {
    const key = buildStorageKey('../other-project', '..\\..\\evil.html.png')
    expect(key.startsWith('projects/other-project/')).toBe(true)
    expect(key.includes('..')).toBe(false)
    expect(key.endsWith('.png')).toBe(true)
  })
})

describe('file access and comment rules', () => {
  it('blocks cross-customer file access', () => {
    expect(canCustomerAccessProjectFile('acct-a', 'acct-b')).toBe(false)
    expect(canCustomerAccessProjectFile('acct-a', 'acct-a')).toBe(true)
  })

  it('hides internal comments from customers', () => {
    const visible = filterCustomerComments([
      { visibility: 'CUSTOMER', body: 'hello' },
      { visibility: 'INTERNAL', body: 'staff only' },
    ])
    expect(visible.map((comment) => comment.body)).toEqual(['hello'])
  })

  it('forces customer comments to CUSTOMER visibility and session author fields', () => {
    const write = buildCustomerCommentWrite({
      projectId: 'proj-1',
      authorUserId: 'user-1',
      body: '  Need the logo  ',
      visibility: 'INTERNAL',
    })
    expect(write).toEqual({
      ok: true,
      data: {
        projectId: 'proj-1',
        authorUserId: 'user-1',
        body: 'Need the logo',
        visibility: 'CUSTOMER',
      },
    })
  })

  it('allows staff customer replies and internal notes, and rejects other visibility', () => {
    expect(parseStaffCommentVisibility('CUSTOMER')).toBe('CUSTOMER')
    expect(parseStaffCommentVisibility('INTERNAL')).toBe('INTERNAL')
    expect(parseStaffCommentVisibility('PRIVATE')).toBeNull()
    expect(
      buildStaffCommentWrite({
        projectId: 'proj-1',
        authorUserId: 'staff-1',
        body: 'Looks good',
        visibility: 'CUSTOMER',
      }).ok,
    ).toBe(true)
    const internal = buildStaffCommentWrite({
      projectId: 'proj-1',
      authorUserId: 'staff-1',
      body: 'Handle billing offline',
      visibility: 'INTERNAL',
    })
    expect(internal.ok && internal.data.visibility).toBe('INTERNAL')
    expect(
      buildStaffCommentWrite({
        projectId: 'proj-1',
        authorUserId: 'staff-1',
        body: 'nope',
        visibility: 'SECRET',
      }),
    ).toEqual({ ok: false, error: 'invalid_visibility' })
  })

  it('limits file deletion to staff and admin', () => {
    expect(canDeleteProjectFile('CUSTOMER')).toBe(false)
    expect(canDeleteProjectFile('STAFF')).toBe(true)
    expect(canDeleteProjectFile('ADMIN')).toBe(true)
  })

  it('rejects cross-project attachment targets', () => {
    expect(canAttachFileToProject('proj-1', 'proj-2')).toBe(false)
    expect(canAttachFileToProject('proj-1', null)).toBe(false)
    expect(canAttachFileToProject('proj-1', 'proj-1')).toBe(true)
  })
})

describe('storage configuration', () => {
  it('returns an explicit not-configured result and does not invent a download URL', async () => {
    delete process.env.STORAGE_SUPABASE_URL
    delete process.env.STORAGE_SUPABASE_SERVICE_KEY
    delete process.env.STORAGE_BUCKET
    resetStorageProviderForTests()
    expect(isStorageConfigured()).toBe(false)
    const provider = getStorageProvider()
    await expect(
      provider.uploadObject({
        storageKey: 'projects/p/file.png',
        originalName: 'file.png',
        mimeType: 'image/png',
        size: 4,
        body: new Uint8Array([1, 2, 3, 4]),
      }),
    ).resolves.toEqual({ ok: false, reason: 'not_configured' })
    await expect(provider.getDownloadUrl('projects/p/file.png')).resolves.toEqual({ ok: false, reason: 'not_configured' })
    await expect(provider.deleteObject('projects/p/file.png')).resolves.toEqual({ ok: false, reason: 'not_configured' })
  })

  it('resolves signed paths without building a permanent public object URL', () => {
    expect(resolveSignedStorageUrl('https://example.supabase.co', '/object/sign/bucket/a?token=1')).toBe(
      'https://example.supabase.co/storage/v1/object/sign/bucket/a?token=1',
    )
    expect(resolveSignedStorageUrl('https://example.supabase.co', 'javascript:alert(1)')).toBeNull()
  })
})

describe('delete sequencing', () => {
  it('removes the database row only after storage deletion succeeds', () => {
    expect(shouldRemoveDatabaseRecord({ ok: true })).toBe(true)
    expect(shouldRemoveDatabaseRecord({ ok: false, reason: 'failed' })).toBe(false)
    expect(shouldRemoveDatabaseRecord({ ok: false, reason: 'not_configured' })).toBe(false)
  })
})
