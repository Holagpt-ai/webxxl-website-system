export function buildHostingPublicId(): string {
  return `HS-${Date.now().toString(36).toUpperCase()}`
}

export function buildDomainPublicId(): string {
  return `MD-${Date.now().toString(36).toUpperCase()}`
}

export function buildEmailPublicId(): string {
  return `BE-${Date.now().toString(36).toUpperCase()}`
}
