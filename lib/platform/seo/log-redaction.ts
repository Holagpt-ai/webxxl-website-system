const TOKEN_PATTERNS = [/ya29\.[0-9A-Za-z\-_]+/g, /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi]

export function redactOAuthLikeSecrets(message: string): string {
  let out = message
  for (const pattern of TOKEN_PATTERNS) {
    out = out.replace(pattern, '[REDACTED_TOKEN]')
  }
  return out
}

export function safeSeoLog(input: { event: string; detail?: Record<string, unknown> }): Record<string, unknown> {
  return {
    event: input.event,
    detail: input.detail ? JSON.parse(redactOAuthLikeSecrets(JSON.stringify(input.detail))) : undefined,
  }
}
