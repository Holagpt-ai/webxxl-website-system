import { hashCaptureSecret, verifyCaptureRequestSignature } from '@/lib/platform/analytics/capture/signature-auth'
import { SITE_LEAD_INTAKE_SIGNATURE_TOLERANCE_SECONDS } from '@/config/site-lead-intake'

export { hashCaptureSecret as hashSiteLeadIntakeSecret }

export type SiteLeadAuthError = 'NOT_CONFIGURED' | 'UNAUTHORIZED'

/** Signing secret stays on the managed site's trusted server — never in browser JavaScript. */
export function resolveSiteLeadIntakeSecretMaterial(input: {
  publicKeyId: string
  secretRef: string | null
  secretHash: string
}): { ok: true; secret: string } | { ok: false; code: SiteLeadAuthError; message: string } {
  const candidates: string[] = []
  if (input.secretRef) {
    const fromRef = process.env[input.secretRef]
    if (fromRef) candidates.push(fromRef)
  }
  const envKey = `SITE_LEAD_INTAKE_SECRET_${input.publicKeyId}`
  const fromEnv = process.env[envKey]
  if (fromEnv) candidates.push(fromEnv)
  for (const secret of candidates) {
    if (hashCaptureSecret(secret) === input.secretHash) {
      return { ok: true, secret }
    }
  }
  return { ok: false, code: 'NOT_CONFIGURED', message: 'Lead intake secret not configured for site key' }
}

export function verifySiteLeadIntakeSignature(input: {
  rawBody: string
  signatureHeader: string | null
  timestampHeader: string | null
  secret: string
  nowMs?: number
}) {
  return verifyCaptureRequestSignature({
    rawBody: input.rawBody,
    signatureHeader: input.signatureHeader,
    timestampHeader: input.timestampHeader,
    secret: input.secret,
    toleranceSeconds: SITE_LEAD_INTAKE_SIGNATURE_TOLERANCE_SECONDS,
    nowMs: input.nowMs,
  })
}
