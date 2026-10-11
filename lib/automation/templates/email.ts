export function buildAutomationEmail(input: {
  locale: 'en' | 'es'
  title: string
  body: string
  actionUrl?: string
}) {
  const footer =
    input.locale === 'es'
      ? 'Este es un mensaje transaccional de WebXXL. No es correo promocional.'
      : 'This is a transactional message from WebXXL. It is not a marketing email.'
  const cta = input.locale === 'es' ? 'Abrir en el portal' : 'Open in portal'
  const subject = input.title
  const actionLine = input.actionUrl ? `\n\n${cta}: ${input.actionUrl}` : ''
  const text = `${input.body}${actionLine}\n\n${footer}`
  const htmlAction = input.actionUrl
    ? `<p><a href="${input.actionUrl}">${cta}</a></p>`
    : ''
  const html = `<p>${input.body.replace(/\n/g, '<br/>')}</p>${htmlAction}<p><small>${footer}</small></p>`
  return { subject, text, html }
}
