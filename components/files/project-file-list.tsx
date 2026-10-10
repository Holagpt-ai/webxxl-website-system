import type { ReactNode } from 'react'
import { formatFileSize } from '@/lib/files/policy'

export type ListedProjectFile = {
  id: string
  originalName: string
  category: string
  size: number
  createdAt: Date
  uploadedBy?: { name: string | null; email: string } | null
}

export function ProjectFileList({
  files,
  locale,
  storageReady,
  downloadLabel,
  categoryLabel,
  trailing,
}: {
  files: ListedProjectFile[]
  locale: string
  storageReady: boolean
  downloadLabel: string
  categoryLabel: (category: string) => string
  trailing?: (file: ListedProjectFile) => ReactNode
}) {
  const dateFormat = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium' })
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {files.map((file) => (
        <li key={file.id} className="flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-medium">{file.originalName}</p>
            <p className="text-muted-foreground">
              {categoryLabel(file.category)} · {formatFileSize(file.size)} · {dateFormat.format(file.createdAt)}
            </p>
            <p className="text-xs text-muted-foreground">{file.uploadedBy?.name || file.uploadedBy?.email || '—'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {storageReady ? (
              <a href={`/api/files/${file.id}`} className="text-primary hover:underline">
                {downloadLabel}
              </a>
            ) : null}
            {trailing?.(file)}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function LinkedFileList({
  files,
  storageReady,
  downloadLabel,
}: {
  files: { id: string; originalName: string }[]
  storageReady: boolean
  downloadLabel: string
}) {
  if (files.length === 0) return null
  return (
    <ul className="mt-3 flex flex-col gap-1 text-sm">
      {files.map((file) => (
        <li key={file.id} className="flex flex-wrap items-center justify-between gap-2">
          <span className="truncate">{file.originalName}</span>
          {storageReady ? (
            <a href={`/api/files/${file.id}`} className="text-primary hover:underline">
              {downloadLabel}
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
