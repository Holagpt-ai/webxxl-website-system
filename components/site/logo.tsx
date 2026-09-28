import { cn } from '@/lib/utils'

export function Logo({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'inverse' }) {
  return (
    <span className={cn('text-2xl font-extrabold tracking-tight', tone === 'inverse' ? 'text-inverse-foreground' : 'text-foreground', className)}>
      Web<span className={tone === 'inverse' ? 'text-chart-2' : 'text-primary'}>XXL</span>
    </span>
  )
}
