export function verifyAutomationWorkerRequest(headers: Headers): boolean {
  const secret = process.env.AUTOMATION_WORKER_SECRET
  if (!secret) return false
  const provided = headers.get('x-automation-worker-secret')
  return Boolean(provided && provided === secret)
}
