import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { SectionCard } from '@/components/dashboard/primitives'
import { cn } from '@/lib/utils'

export function CollaborationLinks({
  localePrefix,
  copy,
}: {
  localePrefix: string
  copy: {
    collaborationHub: string
    collaborationHubBody: string
    goToMessages: string
    goToRequests: string
    goToApprovals: string
    goToFiles: string
  }
}) {
  const links = [
    { href: `${localePrefix}/dashboard/requests`, label: copy.goToRequests },
    { href: `${localePrefix}/dashboard/messages`, label: copy.goToMessages },
    { href: `${localePrefix}/dashboard/approvals`, label: copy.goToApprovals },
    { href: `${localePrefix}/dashboard/files`, label: copy.goToFiles },
  ]
  return (
    <SectionCard title={copy.collaborationHub}>
      <p className="mb-4 text-sm text-muted-foreground">{copy.collaborationHubBody}</p>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            {link.label}
          </Link>
        ))}
      </div>
    </SectionCard>
  )
}
