import { describe, expect, it, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
  findUnique: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    websitePreviewVersion: { findUnique: hoisted.findUnique },
  },
}))

import { assertPreviewVersionForProject } from '@/lib/change-requests/preview-version'

describe('assertPreviewVersionForProject', () => {
  beforeEach(() => {
    hoisted.findUnique.mockReset()
  })

  it('allows null version id', async () => {
    const result = await assertPreviewVersionForProject(null, 'proj-1', 'acct-1')
    expect(result).toEqual({ ok: true, versionId: null })
  })

  it('rejects cross-project version', async () => {
    hoisted.findUnique.mockResolvedValue({
      id: 'ver-1',
      preview: { projectId: 'other-project', customerAccountId: 'acct-1' },
    })
    const result = await assertPreviewVersionForProject('ver-1', 'proj-1', 'acct-1')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('rejects cross-account version', async () => {
    hoisted.findUnique.mockResolvedValue({
      id: 'ver-1',
      preview: { projectId: 'proj-1', customerAccountId: 'acct-2' },
    })
    const result = await assertPreviewVersionForProject('ver-1', 'proj-1', 'acct-1')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('accepts matching project and account', async () => {
    hoisted.findUnique.mockResolvedValue({
      id: 'ver-1',
      preview: { projectId: 'proj-1', customerAccountId: 'acct-1' },
    })
    const result = await assertPreviewVersionForProject('ver-1', 'proj-1', 'acct-1')
    expect(result).toEqual({ ok: true, versionId: 'ver-1' })
  })
})
