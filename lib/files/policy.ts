import type { ProjectFileCategory } from '@prisma/client'

/**
 * V1 server-action upload ceiling. Multipart overhead must stay under the platform request body.
 * Files larger than this should later use a direct-to-object-storage signed upload so the bytes
 * bypass the function request body. That flow is not implemented; StorageProvider and ProjectFile
 * remain the integration points.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export const PROJECT_FILE_CATEGORIES = ['BRAND', 'PHOTO', 'DOCUMENT', 'OTHER'] as const satisfies readonly ProjectFileCategory[]

/**
 * Practical website-project types.
 * Executables and browser-executable markup (HTML, JS, SVG) are rejected.
 */
export const ALLOWED_UPLOAD_TYPES: readonly { mime: string; extensions: readonly string[] }[] = [
  { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
  { mime: 'image/png', extensions: ['.png'] },
  { mime: 'image/webp', extensions: ['.webp'] },
  { mime: 'image/gif', extensions: ['.gif'] },
  { mime: 'application/pdf', extensions: ['.pdf'] },
  { mime: 'text/plain', extensions: ['.txt'] },
  { mime: 'text/csv', extensions: ['.csv'] },
  { mime: 'application/zip', extensions: ['.zip'] },
  { mime: 'application/msword', extensions: ['.doc'] },
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['.docx'] },
  { mime: 'application/vnd.ms-excel', extensions: ['.xls'] },
  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensions: ['.xlsx'] },
  { mime: 'application/vnd.ms-powerpoint', extensions: ['.ppt'] },
  { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extensions: ['.pptx'] },
]

const BLOCKED_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.xhtml',
  '.js',
  '.mjs',
  '.cjs',
  '.svg',
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.msi',
  '.dll',
  '.sh',
  '.ps1',
  '.apk',
  '.php',
  '.jar',
])

export type UploadValidation = 'ok' | 'invalid' | 'too_large'

export function fileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot).toLowerCase()
}

export function sanitizeOriginalName(name: string): string {
  const base = (name.split(/[/\\]/).pop() ?? 'file').replace(/^\.+/, '')
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 180)
  return cleaned || 'file'
}

/** Server-generated object key. Client-supplied keys are never accepted. */
export function buildStorageKey(projectId: string, originalName: string): string {
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '')
  const safeName = sanitizeOriginalName(originalName)
  return `projects/${safeProject}/${crypto.randomUUID()}-${safeName}`
}

export function validateUploadFile(originalName: string, mimeType: string, size: number): UploadValidation {
  if (!Number.isFinite(size) || size <= 0) return 'invalid'
  if (size > MAX_UPLOAD_BYTES) return 'too_large'
  const extension = fileExtension(originalName)
  if (!extension || BLOCKED_EXTENSIONS.has(extension)) return 'invalid'
  const allowed = ALLOWED_UPLOAD_TYPES.some((type) => type.mime === mimeType && type.extensions.includes(extension))
  if (!allowed) return 'invalid'
  return 'ok'
}

export function parseFileCategory(value: unknown): ProjectFileCategory | null {
  if (value === null || value === undefined || value === '') return 'OTHER'
  if (typeof value !== 'string') return null
  return (PROJECT_FILE_CATEGORIES as readonly string[]).includes(value) ? (value as ProjectFileCategory) : null
}

export function allowedUploadAccept(): string {
  return ALLOWED_UPLOAD_TYPES.flatMap((type) => type.extensions).join(',')
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
