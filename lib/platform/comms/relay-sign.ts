import { createHmac } from 'node:crypto'

export function buildChatwootRelaySignature(input: {
  relaySecret: string
  relayTimestampSeconds: number
  rawBody: string
}): string {
  const signedPayload = `${input.relayTimestampSeconds}.${input.rawBody}`
  return createHmac('sha256', input.relaySecret).update(signedPayload).digest('hex')
}
