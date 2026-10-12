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

export type MagicLinkEmailKind = 'sign_in' | 'invitation'

export type MagicLinkEmailLocale = 'en' | 'es'

function magicLinkCopy(kind: MagicLinkEmailKind, locale: MagicLinkEmailLocale) {
  if (kind === 'invitation') {
    if (locale === 'es') {
      return {
        subject: 'Invitación a tu portal de cliente WebXXL',
        intro: 'Has sido invitado a tu portal de cliente de WebXXL.',
        cta: 'Abrir portal',
        footer: 'Si no esperabas este correo, puedes ignorarlo.',
      }
    }
    return {
      subject: 'Invitation to your WebXXL client portal',
      intro: "You've been invited to your WebXXL client portal.",
      cta: 'Open portal',
      footer: 'If you did not expect this email, you can ignore it.',
    }
  }
  if (locale === 'es') {
    return {
      subject: 'Inicia sesión en tu portal de cliente WebXXL',
      intro: 'Inicia sesión en tu portal de cliente WebXXL:',
      cta: 'Iniciar sesión',
      footer: 'Si no solicitaste este correo, puedes ignorarlo.',
    }
  }
  return {
    subject: 'Sign in to your WebXXL client portal',
    intro: 'Sign in to your WebXXL client portal:',
    cta: 'Sign in',
    footer: 'If you did not request this email, you can ignore it.',
  }
}

/** Infer invitation + locale from Auth.js verification URL callbackUrl when present. */
export function parseMagicLinkEmailContext(url: string): { kind: MagicLinkEmailKind; locale: MagicLinkEmailLocale } {
  try {
    const parsed = new URL(url)
    const callbackUrl = parsed.searchParams.get('callbackUrl')
    if (!callbackUrl) return { kind: 'sign_in', locale: 'en' }
    const cb = callbackUrl.startsWith('http') ? new URL(callbackUrl) : new URL(callbackUrl, parsed.origin)
    const invitation = cb.pathname.includes('/api/portal/activate-account')
    const pathLocale = cb.pathname === '/es' || cb.pathname.startsWith('/es/') ? 'es' : 'en'
    const locale = cb.searchParams.get('locale') === 'es' || pathLocale === 'es' ? 'es' : 'en'
    return { kind: invitation ? 'invitation' : 'sign_in', locale }
  } catch {
    return { kind: 'sign_in', locale: 'en' }
  }
}

export async function sendMagicLinkEmail(
  email: string,
  url: string,
  override?: { kind?: MagicLinkEmailKind; locale?: MagicLinkEmailLocale },
): Promise<SendEmailResult> {
  const parsed = parseMagicLinkEmailContext(url)
  const kind = override?.kind ?? parsed.kind
  const locale = override?.locale ?? parsed.locale
  const copy = magicLinkCopy(kind, locale)
  return sendEmail({
    to: email,
    subject: copy.subject,
    text: `${copy.intro}\n\n${url}\n\n${copy.footer}`,
    html: `<p>${copy.intro}</p><p><a href="${url}">${copy.cta}</a></p><p>${copy.footer}</p>`,
  })
}

export function isAuthEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY)
}
