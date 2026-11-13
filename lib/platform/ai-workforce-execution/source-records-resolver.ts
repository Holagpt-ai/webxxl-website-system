/**
 * Server-side source record authorization. Client `sourceRecordIds` are hints only.
 * Returns verified ids only after tenant-scoped reads succeed (not composed in Batch 6 yet).
 */
export function resolveServerAuthorizedSourceRecordIds(_input: {
  customerAccountId: string
  toolKey: string
  candidateRecordIds: string[]
}): string[] {
  return []
}
