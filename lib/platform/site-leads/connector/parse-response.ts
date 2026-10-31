import type {
  SiteLeadConnectorFailure,
  SiteLeadConnectorFailureCode,
  SiteLeadConnectorSuccess,
} from '@/lib/platform/site-leads/connector/types'

function mapCode(status: number, apiCode: string | null): SiteLeadConnectorFailureCode {
  if (apiCode === 'SITE_LEAD_INTAKE_DISABLED') return 'DISABLED'
  if (status === 401 || apiCode === 'UNAUTHORIZED') return 'UNAUTHORIZED'
  if (status === 409 || apiCode === 'CONFLICT') return 'CONFLICT'
  if (status === 429 || apiCode === 'RATE_LIMIT') return 'RATE_LIMITED'
  if (status === 400 || apiCode === 'VALIDATION' || apiCode === 'INVALID_JSON') return 'VALIDATION'
  if (status >= 500) return 'UNAVAILABLE'
  return 'ERROR'
}

export function isRetryableConnectorFailure(code: SiteLeadConnectorFailureCode): boolean {
  return code === 'UNAVAILABLE' || code === 'RATE_LIMITED' || code === 'TIMEOUT' || code === 'NETWORK'
}

export async function parseSiteLeadIntakeResponse(
  res: Response,
): Promise<SiteLeadConnectorSuccess | SiteLeadConnectorFailure> {
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const apiCode = typeof record?.code === 'string' ? record.code : null
  const message = typeof record?.message === 'string' ? record.message : `HTTP ${res.status}`

  if (res.ok && record?.ok === true && typeof record.leadId === 'string') {
    return {
      ok: true,
      leadId: record.leadId,
      status: typeof record.status === 'string' ? record.status : 'RECEIVED',
      duplicate: Boolean(record.duplicate),
      httpStatus: res.status,
    }
  }

  return {
    ok: false,
    code: mapCode(res.status, apiCode),
    message,
    httpStatus: res.status,
  }
}
