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
  resolveSiteLeadConnectorConfigFromEnv,
  submitManagedSiteLead,
  type SiteLeadConnectorPayload,
} from '@/lib/platform/site-leads/connector'

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

  const result = await submitManagedSiteLead({
    config,
    payload: {
      ...form,
      submittedAt: form.submittedAt ?? new Date().toISOString(),
    },
    idempotencyKey: request.headers.get('x-idempotency-key'),
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
    { ok: true, leadId: result.leadId, status: result.status, duplicate: result.duplicate },
    { status: result.duplicate ? 200 : 201 },
  )
}
