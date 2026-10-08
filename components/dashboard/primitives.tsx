import { Badge } from '@/components/ui/badge'

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-8 flex flex-col gap-2">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      {description && <p className="max-w-2xl text-muted-foreground">{description}</p>}
    </header>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  )
}

export function StatusBadge({ label, tone }: { label: string; tone?: 'default' | 'success' | 'warn' }) {
  const variant = tone === 'success' ? 'default' : tone === 'warn' ? 'secondary' : 'outline'
  return <Badge variant={variant}>{label}</Badge>
}

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}
