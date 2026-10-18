import { createHash } from 'node:crypto'

export function buildCommunicationContentHash(input: {
  customerAccountId: string
  senderIdentityId: string | null
  recipient: string
  channel: string
  purpose: string
  contentVersion: string
  policyVersion: string
}): string {
  const payload = JSON.stringify(input)
  return createHash('sha256').update(payload).digest('hex')
}
