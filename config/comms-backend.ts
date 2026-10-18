/**
 * Backend-owned unified communications gates (not customer UI flags).
 */

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

export function isCommsBackendEnabled(): boolean {
  return envFlag('COMMS_BACKEND_ENABLED', false)
}

export function isChatwootApiEnabled(): boolean {
  return envFlag('CHATWOOT_API_ENABLED', false)
}

export function isChatwootWebhookIngestEnabled(): boolean {
  return envFlag('CHATWOOT_WEBHOOK_INGEST_ENABLED', false)
}

export function isCommunicationsOutboundEnabled(): boolean {
  return envFlag('COMMUNICATIONS_OUTBOUND_ENABLED', false)
}

export function isSmsSendEnabled(): boolean {
  return envFlag('SMS_SEND_ENABLED', false)
}

export function isEmailSendEnabled(): boolean {
  return envFlag('EMAIL_SEND_ENABLED', false)
}

export function isWhatsappSendEnabled(): boolean {
  return envFlag('WHATSAPP_SEND_ENABLED', false)
}

export function isAiCommunicationActionsEnabled(): boolean {
  return envFlag('AI_COMMUNICATION_ACTIONS_ENABLED', false)
}

/** Pinned staging image reference (INFRA-02); not proof of a live instance. */
export const CHATWOOT_PINNED_EDITION = 'chatwoot/chatwoot:v4.18.0-ce'

export const COMMS_WEBHOOK_MAX_BODY_BYTES = Number(process.env.COMMS_WEBHOOK_MAX_BODY_BYTES ?? '262144')
export const COMMS_LIST_DEFAULT_TAKE = Number(process.env.COMMS_LIST_DEFAULT_TAKE ?? '50')
export const COMMS_LIST_MAX_TAKE = Number(process.env.COMMS_LIST_MAX_TAKE ?? '100')
export const COMMS_QUOTE_MAX_RECIPIENTS = Number(process.env.COMMS_QUOTE_MAX_RECIPIENTS ?? '200')
export const COMMS_CONVERSATION_STALE_MINUTES = Number(process.env.COMMS_CONVERSATION_STALE_MINUTES ?? '60')
export const COMMS_WEBHOOK_REPLAY_TOLERANCE_SECONDS = Number(process.env.COMMS_WEBHOOK_REPLAY_TOLERANCE_SECONDS ?? '300')
