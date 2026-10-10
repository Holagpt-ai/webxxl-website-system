'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { switchCustomerAccountAction } from '@/lib/portal/customer-actions'

type AccountOption = { customerAccountId: string; businessName: string }

export function CustomerAccountSwitcher({
  accounts,
  activeAccountId,
}: {
  accounts: AccountOption[]
  activeAccountId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (accounts.length <= 1) return null

  return (
    <div className="mb-4">
      <label htmlFor="customer-account-switch" className="sr-only">
        Customer account
      </label>
      <select
        id="customer-account-switch"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm font-medium"
        value={activeAccountId}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value
          if (next === activeAccountId) return
          startTransition(async () => {
            const result = await switchCustomerAccountAction(next)
            if (result.ok) router.refresh()
          })
        }}
      >
        {accounts.map((a) => (
          <option key={a.customerAccountId} value={a.customerAccountId}>
            {a.businessName}
          </option>
        ))}
      </select>
    </div>
  )
}
