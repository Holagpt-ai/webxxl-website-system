/**
 * First-party capture trust boundary (Batch 15.1).
 *
 * - `publicKeyId` may appear in managed-site front-end code as an untrusted identifier only.
 * - HMAC signing secret MUST live on the managed site's trusted server (or WebXXL backend relay), never in browser JavaScript.
 * - `consentGranted: true` is a client assertion that the originating site obtained consent; WebXXL does not independently verify CMP/legal proof here.
 * - Operators must configure `AnalyticsConversionDefinition` before `custom_conversion` keys are accepted.
 */
export const ANALYTICS_CAPTURE_TRUST_MODEL_VERSION = '2026-10-25' as const

export const CAPTURE_CONSENT_DISCLAIMER =
  'consentGranted asserts the originating site collected consent; WebXXL does not verify legal proof in this API.'
