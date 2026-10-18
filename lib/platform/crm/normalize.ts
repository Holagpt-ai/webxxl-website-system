export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizePhone(value: string, defaultRegion = 'US'): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10 && defaultRegion === 'US') return `+1${digits}`
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`
  if (value.trim().startsWith('+')) return `+${digits}`
  return `+${digits}`
}

export function escapeCsvCell(value: string): string {
  const trimmed = value.trim()
  if (/^[=+\-@]/.test(trimmed)) return `'${trimmed}`
  if (trimmed.includes(',') || trimmed.includes('"') || trimmed.includes('\n')) {
    return `"${trimmed.replace(/"/g, '""')}"`
  }
  return trimmed
}
