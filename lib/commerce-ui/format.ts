const intlLocale = (locale: string) => (locale === 'es' ? 'es-US' : 'en-US')

export function formatMoney(amountMinor: number, currency: string, locale: string) {
  try {
    const formatter = new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency })
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
    return formatter.format(amountMinor / 10 ** digits)
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`
  }
}

export function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(intlLocale(locale)).format(value)
}

export function formatDate(iso: string, locale: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(intlLocale(locale), { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}
