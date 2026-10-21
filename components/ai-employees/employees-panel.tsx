'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { aiBase, useAi, withPage, type AiEmployee, type PageResult } from '@/lib/ai-employees-ui/client'
import { fill } from '@/lib/commerce-ui/format'
import { AiPagination, AiState, EmptyNote, LoadingRows, Section, StatusPill, TableFrame, lifecycleTone, localeLabel, td, th } from './ui'
import { CreateEmployeeDialog } from './create-employee-dialog'
import { EmployeeDetail } from './employee-detail'
import type { WorkforceContext } from './workforce-view'

const PAGE = 10

export function EmployeesPanel({ ctx }: { ctx: WorkforceContext }) {
  const { copy, accountId, accountName, policy } = ctx
  const [skip, setSkip] = useState(0)
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const listUrl = withPage(`${aiBase(accountId)}/employees`, PAGE, skip)
  const { data, error, isLoading, mutate } = useAi<PageResult<AiEmployee>>(listUrl)

  const refresh = () => {
    mutate()
    ctx.refreshPolicy()
  }

  return (
    <Section
      title={copy.employees.title}
      description={copy.employees.description}
      action={
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {fill(copy.employees.activeCount, { active: policy.activeEmployeeCount, max: policy.maxActiveEmployees })}
          </span>
          <Button size="sm" onClick={() => setCreating(true)} disabled={policy.emergencyDisabled}>
            <Plus className="size-4" aria-hidden="true" />
            {copy.employees.create}
          </Button>
        </div>
      }
    >
      {error && !data ? (
        <AiState error={error} copy={copy} onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <LoadingRows label={copy.employees.loading} />
      ) : data.items.length === 0 ? (
        <EmptyNote>{copy.employees.empty}</EmptyNote>
      ) : (
        <div className="flex flex-col gap-4">
          <TableFrame label={copy.employees.title}>
            <thead>
              <tr>
                <th className={th}>{copy.employees.role}</th>
                <th className={th}>{copy.common.status}</th>
                <th className={th}>{copy.common.languages}</th>
                <th className={th}>{copy.employees.account}</th>
                <th className={th}>
                  <span className="sr-only">{copy.common.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((employee) => (
                <tr key={employee.id} className="border-t">
                  <td className={td}>
                    <p className="font-medium text-foreground">{employee.displayName}</p>
                    <p className="text-xs text-muted-foreground">{employee.roleTitle}</p>
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusPill tone={lifecycleTone(employee.status)} label={copy.lifecycle[employee.status]} />
                      {employee.emergencyPaused && <StatusPill tone="danger" label={copy.employees.emergencyPaused} />}
                    </div>
                  </td>
                  <td className={td}>
                    {[employee.primaryLocale, ...employee.secondaryLocales].map((tag) => localeLabel(copy, tag)).join(', ')}
                  </td>
                  <td className={td}>
                    <span className="text-muted-foreground">{accountName}</span>
                  </td>
                  <td className={`${td} text-right`}>
                    <Button variant="outline" size="sm" onClick={() => setSelectedId(employee.id)}>
                      {copy.employees.manage}
                      <span className="sr-only">: {employee.displayName}</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
          <AiPagination total={data.pagination.total} take={PAGE} skip={skip} onChange={setSkip} copy={copy} />
        </div>
      )}

      <CreateEmployeeDialog
        open={creating}
        onOpenChange={setCreating}
        ctx={ctx}
        onCreated={(employee) => {
          refresh()
          setSelectedId(employee.id)
        }}
      />

      <Sheet open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{copy.detail.title}</SheetTitle>
            <SheetDescription>{accountName}</SheetDescription>
          </SheetHeader>
          {selectedId && <EmployeeDetail employeeId={selectedId} ctx={ctx} onChanged={refresh} />}
        </SheetContent>
      </Sheet>
    </Section>
  )
}
