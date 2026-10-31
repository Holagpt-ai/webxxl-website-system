import { signSiteLeadIntakeRequest } from '@/lib/platform/site-leads/signature-auth'
import { normalizeSiteLeadConnectorConfig } from '@/lib/platform/site-leads/connector/config'
import { resolveSiteLeadIdempotencyKey } from '@/lib/platform/site-leads/connector/idempotency'
import {
  isRetryableConnectorFailure,
  parseSiteLeadIntakeResponse,
} from '@/lib/platform/site-leads/connector/parse-response'
import { serializeSiteLeadIntakeBody } from '@/lib/platform/site-leads/connector/serialize'
import type {
  SiteLeadConnectorConfig,
  SiteLeadConnectorPayload,
  SiteLeadConnectorResult,
} from '@/lib/platform/site-leads/connector/types'

export const SITE_LEAD_INTAKE_PATH = '/api/v1/site-leads/intake'

export type SubmitManagedSiteLeadInput = {
  config: SiteLeadConnectorConfig
  payload: SiteLeadConnectorPayload
  /** Stable across retries for the same submission; derived from raw body when omitted. */
  idempotencyKey?: string | null
  fetchImpl?: typeof fetch
  nowMs?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Submit a contact-form lead to WebXXL CRM intake (server-side only).
 * Does not grant marketing consent and does not send outbound messages.
 */
export async function submitManagedSiteLead(input: SubmitManagedSiteLeadInput): Promise<SiteLeadConnectorResult> {
  let config: SiteLeadConnectorConfig
  try {
    config = normalizeSiteLeadConnectorConfig(input.config)
  } catch (error) {
    return {
      ok: false,
      code: 'CONFIG',
      message: error instanceof Error ? error.message : 'Invalid connector configuration',
    }
  }

  let rawBody: string
  try {
    rawBody = serializeSiteLeadIntakeBody(input.payload)
  } catch (error) {
    return {
      ok: false,
      code: 'VALIDATION',
      message: error instanceof Error ? error.message : 'Invalid lead payload',
    }
  }

  const idempotencyKey = resolveSiteLeadIdempotencyKey({
    payload: input.payload,
    rawBody,
    explicitKey: input.idempotencyKey,
  })

  const url = `${config.intakeBaseUrl}${SITE_LEAD_INTAKE_PATH}`
  const fetchFn = input.fetchImpl ?? fetch
  const maxAttempts = 1 + Math.max(0, config.maxRetries ?? 0)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const timestampSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000)
    const { timestampHeader, signatureHeader } = signSiteLeadIntakeRequest({
      rawBody,
      secret: config.signingSecret,
      timestampSeconds,
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 15_000)

    try {
      const res = await fetchFn(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-webxxl-lead-intake-key': config.publicKeyId,
          'x-idempotency-key': idempotencyKey,
          'x-webxxl-timestamp': timestampHeader,
          'x-webxxl-signature': signatureHeader,
        },
        body: rawBody,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const parsed = await parseSiteLeadIntakeResponse(res)
      if (parsed.ok) return parsed

      if (attempt < maxAttempts - 1 && isRetryableConnectorFailure(parsed.code)) {
        await sleep(250 * (attempt + 1))
        continue
      }
      return parsed
    } catch (error) {
      clearTimeout(timeout)
      const isAbort = error instanceof Error && error.name === 'AbortError'
      const failure: SiteLeadConnectorResult = {
        ok: false,
        code: isAbort ? 'TIMEOUT' : 'NETWORK',
        message: isAbort ? 'Lead intake request timed out' : 'Lead intake request failed',
      }
      if (attempt < maxAttempts - 1 && isRetryableConnectorFailure(failure.code)) {
        await sleep(250 * (attempt + 1))
        continue
      }
      return failure
    }
  }

  return { ok: false, code: 'UNAVAILABLE', message: 'Lead intake unavailable after retries' }
}
