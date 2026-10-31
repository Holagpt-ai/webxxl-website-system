/** Stable inbox cursor aligned with `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`. */
export function encodeSiteLeadListCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url')
}

export function decodeSiteLeadListCursor(raw: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    const sep = decoded.indexOf('|')
    if (sep <= 0) return null
    const createdAt = new Date(decoded.slice(0, sep))
    const id = decoded.slice(sep + 1)
    if (!id || Number.isNaN(createdAt.getTime())) return null
    return { createdAt, id }
  } catch {
    return null
  }
}
