/**
 * Provider-neutral transactional email (Resend). Reused for auth magic links and future notifications.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const AUTH_FROM_EMAIL = process.env.AUTH_FROM_EMAIL ?? process.env.LEADS_FROM_EMAIL ?? 'onboarding@resend.dev'

export type SendEmailResult = { ok: true; id: string } | { ok: false; reason: 'not_configured' | 'failed' }

export async function sendEmail(options: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) return { ok: false, reason: 'not_configured' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `WebXXL <${AUTH_FROM_EMAIL}>`,
        to: [options.to],
        subject: options.subject,
        text: options.text,
        html: options.html ?? options.text.replace(/\n/g, '<br/>'),
      }),
    })
    if (!res.ok) return { ok: false, reason: 'failed' }
    const data = (await res.json()) as { id?: string }
    return { ok: true, id: data.id ?? 'sent' }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

export async function sendMagicLinkEmail(email: string, url: string): Promise<SendEmailResult> {
  return sendEmail({
    to: email,
    subject: 'Sign in to your WebXXL client portal',
    text: `Sign in to your WebXXL client portal:\n\n${url}\n\nIf you did not request this email, you can ignore it.`,
    html: `<p>Sign in to your WebXXL client portal:</p><p><a href="${url}">Sign in</a></p><p>If you did not request this email, you can ignore it.</p>`,
  })
}

export function isAuthEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY)
}
