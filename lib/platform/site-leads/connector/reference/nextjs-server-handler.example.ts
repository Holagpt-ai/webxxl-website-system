/**
 * Batch 29A reference — Next.js App Router server handler (not mounted in production).
 * Copy this pattern into a customer site's trusted server (Route Handler or Server Action).
 *
 * Requirements:
 * - `WEBXXL_SITE_LEAD_INTAKE_BASE_URL`, `WEBXXL_SITE_LEAD_INTAKE_PUBLIC_KEY_ID`
 * - `SITE_LEAD_INTAKE_SECRET_{publicKeyId}` on the server only
 * - Browser posts to YOUR route; YOUR server signs and forwards to WebXXL intake.
 */
import { NextResponse } from 'next/server'
import {
  newSiteLeadSubmissionId,
  resolveSiteLeadConnectorConfigFromEnv,
  submitManagedSiteLead,
  validateExplicitSiteLeadSubmissionId,
  type SiteLeadConnectorPayload,
} from '@/lib/platform/site-leads/connector'

function readSubmissionIdHeader(request: Request): string | null {
  return request.headers.get('x-webxxl-submission-id') ?? request.headers.get('x-idempotency-key')
}

export async function POST(request: Request) {
  let form: SiteLeadConnectorPayload
  try {
    form = (await request.json()) as SiteLeadConnectorPayload
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 })
  }

  let config
  try {
    config = resolveSiteLeadConnectorConfigFromEnv()
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Not configured' },
      { status: 503 },
    )
  }

  const headerSubmission = readSubmissionIdHeader(request)
  let submissionId: string
  try {
    submissionId =
      headerSubmission != null && headerSubmission.trim() !== ''
        ? validateExplicitSiteLeadSubmissionId(headerSubmission)
        : newSiteLeadSubmissionId()
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Invalid submission id' },
      { status: 400 },
    )
  }

  const isRetry = headerSubmission != null && headerSubmission.trim() !== ''
  const payload: SiteLeadConnectorPayload = {
    ...form,
    submittedAt: form.submittedAt ?? (isRetry ? undefined : new Date().toISOString()),
  }

  const result = await submitManagedSiteLead({
    config,
    payload,
    submissionId,
  })

  if (!result.ok) {
    const status =
      result.code === 'DISABLED' || result.code === 'UNAVAILABLE'
        ? 503
        : result.code === 'RATE_LIMITED'
          ? 429
          : result.code === 'UNAUTHORIZED'
            ? 502
            : result.httpStatus ?? 400
    return NextResponse.json({ ok: false, code: result.code, message: result.message }, { status })
  }

  return NextResponse.json(
    {
      ok: true,
      leadId: result.leadId,
      status: result.status,
      duplicate: result.duplicate,
      submissionId,
    },
    {
      status: result.duplicate ? 200 : 201,
      headers: { 'x-webxxl-submission-id': submissionId },
    },
  )
}
