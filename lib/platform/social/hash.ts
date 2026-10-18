export function stableSocialContentHash(payload: unknown): string {
  const json = JSON.stringify(payload ?? null)
  return Buffer.from(json, 'utf8').toString('base64url')
}
