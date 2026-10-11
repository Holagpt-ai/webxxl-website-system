import { timingSafeEqual } from 'node:crypto'

export function verifyAutomationWorkerRequest(headers: Headers): boolean {
  const secret = process.env.AUTOMATION_WORKER_SECRET
  if (!secret) return false
  const provided = headers.get('x-automation-worker-secret') ?? ''
  if (!provided) return false
  const expected = Buffer.from(secret)
  const actual = Buffer.from(provided)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
