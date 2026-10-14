import type { ChangeRequestCategory } from '@prisma/client'

export const CHANGE_REQUEST_CATEGORIES: ChangeRequestCategory[] = [
  'DESIGN',
  'CONTENT',
  'MEDIA',
  'FUNCTIONALITY',
  'OTHER',
]

export function parseChangeRequestCategory(value: unknown): ChangeRequestCategory | null {
  if (typeof value !== 'string') return null
  return CHANGE_REQUEST_CATEGORIES.includes(value as ChangeRequestCategory) ? (value as ChangeRequestCategory) : null
}
