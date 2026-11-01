import { validateGoogleOAuthSecretRef } from '@/lib/platform/google/credential-ref'
import type { GoogleCredentialLifecycle, StoredGoogleConnectionSnapshot } from '@/lib/platform/google/types'
import type { SeoResult } from '@/lib/platform/seo/types'

export function assessGoogleCredentialLifecycle(
  connection: Pick<
    StoredGoogleConnectionSnapshot,
    'secretRef' | 'verificationState' | 'revokedAt'
  > | null,
): SeoResult<{ lifecycle: GoogleCredentialLifecycle }> {
  if (!connection) {
    return { ok: true, value: { lifecycle: 'MISSING' } }
  }
  if (connection.revokedAt || connection.verificationState === 'REVOKED') {
    return { ok: true, value: { lifecycle: 'REVOKED' } }
  }
  const ref = validateGoogleOAuthSecretRef(connection.secretRef)
  if (!ref.ok) return ref
  if (!ref.value.configured) {
    return { ok: true, value: { lifecycle: 'MISSING' } }
  }
  if (connection.verificationState !== 'VERIFIED') {
    return { ok: true, value: { lifecycle: 'INCOMPLETE' } }
  }
  return { ok: true, value: { lifecycle: 'ACTIVE' } }
}
