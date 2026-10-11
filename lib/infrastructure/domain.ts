const DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

export function normalizeDomainName(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/\.$/, '')
  if (!trimmed || trimmed.length > 253) return null
  if (!DOMAIN_PATTERN.test(trimmed)) return null
  return trimmed
}
