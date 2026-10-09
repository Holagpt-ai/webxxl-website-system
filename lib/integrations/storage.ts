/**
 * Provider-neutral object storage abstraction.
 * Live uploads require STORAGE_* env configuration.
 */

export type StorageUploadRequest = {
  storageKey: string
  mimeType: string
  size: number
}

export type StorageUploadResult =
  | { ok: true; uploadUrl: string; storageKey: string }
  | { ok: false; reason: 'not_configured' | 'invalid' | 'too_large' }

export type StorageDownloadResult = { ok: true; url: string } | { ok: false; reason: 'not_configured' | 'missing' }

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'application/zip',
  'text/plain',
])

export interface StorageProvider {
  createUpload(input: StorageUploadRequest): Promise<StorageUploadResult>
  getDownloadUrl(storageKey: string): Promise<StorageDownloadResult>
  deleteObject(storageKey: string): Promise<boolean>
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180)
}

export function buildStorageKey(projectId: string, originalName: string): string {
  const safe = sanitizeFilename(originalName)
  return `projects/${projectId}/${Date.now()}-${safe}`
}

export function validateUpload(mimeType: string, size: number): 'ok' | 'invalid' | 'too_large' {
  if (size > MAX_UPLOAD_BYTES) return 'too_large'
  if (!ALLOWED_MIME.has(mimeType)) return 'invalid'
  return 'ok'
}

class UnconfiguredStorageProvider implements StorageProvider {
  async createUpload(): Promise<StorageUploadResult> {
    return { ok: false, reason: 'not_configured' }
  }
  async getDownloadUrl(): Promise<StorageDownloadResult> {
    return { ok: false, reason: 'not_configured' }
  }
  async deleteObject(): Promise<boolean> {
    return false
  }
}

/** Supabase-compatible signed URL upload (when configured). */
class SupabaseStorageProvider implements StorageProvider {
  constructor(
    private url: string,
    private serviceKey: string,
    private bucket: string,
  ) {}

  async createUpload(input: StorageUploadRequest): Promise<StorageUploadResult> {
    const validation = validateUpload(input.mimeType, input.size)
    if (validation !== 'ok') return { ok: false, reason: validation }

    const uploadUrl = `${this.url.replace(/\/$/, '')}/storage/v1/object/${this.bucket}/${input.storageKey}`
    return { ok: true, uploadUrl, storageKey: input.storageKey }
  }

  async getDownloadUrl(storageKey: string): Promise<StorageDownloadResult> {
    const signed = `${this.url.replace(/\/$/, '')}/storage/v1/object/sign/${this.bucket}/${storageKey}`
    try {
      const res = await fetch(signed, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: 3600 }),
      })
      if (!res.ok) return { ok: false, reason: 'missing' }
      const data = (await res.json()) as { signedURL?: string }
      if (!data.signedURL) return { ok: false, reason: 'missing' }
      return { ok: true, url: data.signedURL.startsWith('http') ? data.signedURL : `${this.url}${data.signedURL}` }
    } catch {
      return { ok: false, reason: 'missing' }
    }
  }

  async deleteObject(storageKey: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.url.replace(/\/$/, '')}/storage/v1/object/${this.bucket}/${storageKey}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.serviceKey}` },
        },
      )
      return res.ok
    } catch {
      return false
    }
  }
}

let provider: StorageProvider | null = null

export function getStorageProvider(): StorageProvider {
  if (provider) return provider
  const url = process.env.STORAGE_SUPABASE_URL
  const key = process.env.STORAGE_SUPABASE_SERVICE_KEY
  const bucket = process.env.STORAGE_BUCKET
  if (url && key && bucket) {
    provider = new SupabaseStorageProvider(url, key, bucket)
  } else {
    provider = new UnconfiguredStorageProvider()
  }
  return provider
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.STORAGE_SUPABASE_URL && process.env.STORAGE_SUPABASE_SERVICE_KEY && process.env.STORAGE_BUCKET)
}
