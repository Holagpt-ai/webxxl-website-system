import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type BaseProps = {
  id: string
  label: string
  error?: string
  optionalLabel?: string
  className?: string
}

function FieldShell({ id, label, error, optionalLabel, className, children }: BaseProps & { children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
        {optionalLabel && <span className="font-normal text-muted-foreground"> ({optionalLabel})</span>}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextField({
  type = 'text',
  value,
  onChange,
  autoComplete,
  required,
  ...base
}: BaseProps & { type?: string; value: string; onChange: (v: string) => void; autoComplete?: string; required?: boolean }) {
  return (
    <FieldShell {...base}>
      <Input
        id={base.id}
        name={base.id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={Boolean(base.error) || undefined}
        aria-describedby={base.error ? `${base.id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 bg-card"
      />
    </FieldShell>
  )
}

export function TextAreaField({ value, onChange, required, ...base }: BaseProps & { value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <FieldShell {...base}>
      <Textarea
        id={base.id}
        name={base.id}
        value={value}
        required={required}
        rows={5}
        aria-invalid={Boolean(base.error) || undefined}
        aria-describedby={base.error ? `${base.id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="bg-card"
      />
    </FieldShell>
  )
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  ...base
}: BaseProps & { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <FieldShell {...base}>
      <select
        id={base.id}
        name={base.id}
        value={value}
        aria-invalid={Boolean(base.error) || undefined}
        aria-describedby={base.error ? `${base.id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-md border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

/** Accessible selectable card group (radio or checkbox semantics). */
export function ChoiceGroup({
  legend,
  options,
  selected,
  onToggle,
  multiple = false,
  columns = 2,
}: {
  legend: string
  options: string[]
  selected: string[]
  onToggle: (option: string) => void
  multiple?: boolean
  columns?: 2 | 3
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">{legend}</legend>
      <div className={cn('grid gap-3', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        {options.map((option) => {
          const checked = selected.includes(option)
          return (
            <label
              key={option}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                checked ? 'border-primary bg-secondary text-secondary-foreground' : 'hover:border-primary/50',
              )}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={legend}
                value={option}
                checked={checked}
                onChange={() => onToggle(option)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center border',
                  multiple ? 'rounded-md' : 'rounded-full',
                  checked ? 'border-primary bg-primary text-primary-foreground' : 'bg-background',
                )}
              >
                {checked && <Check className="size-3.5" />}
              </span>
              {option}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Hidden honeypot — bots fill it, humans never see it. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
      <label htmlFor="website_url">Website</label>
      <input id="website_url" name="website_url" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
