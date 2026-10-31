/**
 * Batch 29A reference — Next.js App Router server handler (not mounted in production).
 * Copy this pattern into a customer site's trusted server (Route Handler or Server Action).
 *
 * Requirements:
 * - `WEBXXL_SITE_LEAD_INTAKE_BASE_URL`, `WEBXXL_SITE_LEAD_INTAKE_PUBLIC_KEY_ID`
 * - `SITE_LEAD_INTAKE_SECRET_{publicKeyId}` on the server only
 * - Browser posts to YOUR route; YOUR server signs and forwards to WebXXL intake.
 * - Browser generates a stable `x-webxxl-submission-id` (UUID) before the first POST and sends the
 *   same header plus the same JSON body (including `submittedAt`) on every retry attempt.
 */
import { NextResponse } from 'next/server'
import {
  resolveSiteLeadConnectorConfigFromEnv,
  submitManagedSiteLead,
  validateExplicitSiteLeadSubmissionId,
  type SiteLeadConnectorPayload,
} from '@/lib/platform/site-leads/connector'

export const SITE_LEAD_SUBMISSION_ID_HEADER = 'x-webxxl-submission-id'

function readSubmissionIdHeader(request: Request): string | null {
  return request.headers.get(SITE_LEAD_SUBMISSION_ID_HEADER) ?? request.headers.get('x-idempotency-key')
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
  if (headerSubmission === null) {
    return NextResponse.json(
      {
        ok: false,
        code: 'VALIDATION',
        message: `${SITE_LEAD_SUBMISSION_ID_HEADER} is required — generate a stable UUID in the browser before the first submit`,
      },
      { status: 400 },
    )
  }

  let submissionId: string
  try {
    submissionId = validateExplicitSiteLeadSubmissionId(headerSubmission)
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: 'VALIDATION', message: error instanceof Error ? error.message : 'Invalid submission id' },
      { status: 400 },
    )
  }

  const result = await submitManagedSiteLead({
    config,
    payload: form,
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
      headers: { [SITE_LEAD_SUBMISSION_ID_HEADER]: submissionId },
    },
  )
}
