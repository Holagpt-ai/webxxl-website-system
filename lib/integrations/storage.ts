/**
 * Provider-neutral object storage.
 * Business logic talks to StorageProvider only.
 * Credentials stay on the server; callers receive short-lived signed download URLs.
 */

import { validateUploadFile, type UploadValidation } from '@/lib/files/policy'

export type StorageObjectUpload = {
  storageKey: string
  originalName: string
  mimeType: string
  size: number
  body: Uint8Array
}

export type StorageMutationResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | UploadValidation | 'failed' }

export type StorageDownloadResult = { ok: true; url: string } | { ok: false; reason: 'not_configured' | 'missing' }

export type StorageDeleteResult = { ok: true } | { ok: false; reason: 'not_configured' | 'failed' }

export interface StorageProvider {
  uploadObject(input: StorageObjectUpload): Promise<StorageMutationResult>
  getDownloadUrl(storageKey: string): Promise<StorageDownloadResult>
  deleteObject(storageKey: string): Promise<StorageDeleteResult>
}

const SIGNED_URL_TTL_SECONDS = 900

export function encodeStorageKey(storageKey: string): string {
  return storageKey
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

/** Turn a provider signed-path into an absolute URL without inventing a public object URL. */
export function resolveSignedStorageUrl(baseUrl: string, signedURL: string): string | null {
  if (signedURL.startsWith('https://') || signedURL.startsWith('http://')) return signedURL
  const base = baseUrl.replace(/\/$/, '')
  if (signedURL.startsWith('/storage/v1/')) return `${base}${signedURL}`
  if (signedURL.startsWith('/object/')) return `${base}/storage/v1${signedURL}`
  return null
}

export function isSafeDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

class UnconfiguredStorageProvider implements StorageProvider {
  async uploadObject(): Promise<StorageMutationResult> {
    return { ok: false, reason: 'not_configured' }
  }
  async getDownloadUrl(): Promise<StorageDownloadResult> {
    return { ok: false, reason: 'not_configured' }
  }
  async deleteObject(): Promise<StorageDeleteResult> {
    return { ok: false, reason: 'not_configured' }
  }
}

/** Supabase Storage adapter. Selected only when STORAGE_* env vars are present. */
class SupabaseStorageProvider implements StorageProvider {
  constructor(
    private url: string,
    private serviceKey: string,
    private bucket: string,
  ) {}

  async uploadObject(input: StorageObjectUpload): Promise<StorageMutationResult> {
    const validation = validateUploadFile(input.originalName, input.mimeType, input.size)
    if (validation !== 'ok') return { ok: false, reason: validation }
    const key = encodeStorageKey(input.storageKey)
    if (!key) return { ok: false, reason: 'invalid' }
    try {
      const res = await fetch(`${this.origin()}/storage/v1/object/${this.bucket}/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.serviceKey}`,
          'Content-Type': input.mimeType,
          'x-upsert': 'false',
        },
        body: input.body,
      })
      if (!res.ok) return { ok: false, reason: 'failed' }
      return { ok: true }
    } catch {
      return { ok: false, reason: 'failed' }
    }
  }

  async getDownloadUrl(storageKey: string): Promise<StorageDownloadResult> {
    const key = encodeStorageKey(storageKey)
    if (!key) return { ok: false, reason: 'missing' }
    try {
      const res = await fetch(`${this.origin()}/storage/v1/object/sign/${this.bucket}/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
      })
      if (!res.ok) return { ok: false, reason: 'missing' }
      const data = (await res.json()) as { signedURL?: string; signedUrl?: string }
      const signed = data.signedURL ?? data.signedUrl
      if (!signed) return { ok: false, reason: 'missing' }
      const url = resolveSignedStorageUrl(this.origin(), signed)
      if (!url || !isSafeDownloadUrl(url)) return { ok: false, reason: 'missing' }
      return { ok: true, url }
    } catch {
      return { ok: false, reason: 'missing' }
    }
  }

  async deleteObject(storageKey: string): Promise<StorageDeleteResult> {
    const key = encodeStorageKey(storageKey)
    if (!key) return { ok: false, reason: 'failed' }
    try {
      const res = await fetch(`${this.origin()}/storage/v1/object/${this.bucket}/${key}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.serviceKey}` },
      })
      if (res.ok || res.status === 404) return { ok: true }
      return { ok: false, reason: 'failed' }
    } catch {
      return { ok: false, reason: 'failed' }
    }
  }

  private origin(): string {
    return this.url.replace(/\/$/, '')
  }
}

let provider: StorageProvider | null = null

export function resetStorageProviderForTests(): void {
  provider = null
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.STORAGE_SUPABASE_URL && process.env.STORAGE_SUPABASE_SERVICE_KEY && process.env.STORAGE_BUCKET)
}

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
