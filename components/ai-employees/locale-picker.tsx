'use client'

import type { AiEmployeesCopy } from '@/lib/i18n/dictionaries/ai-employees-en'
import { Field, selectClass } from './ui'

const LOCALES = ['en', 'es'] as const

export function LocalePicker({
  idPrefix,
  copy,
  primary,
  secondary,
  onPrimaryChange,
  onSecondaryChange,
  disabled,
}: {
  idPrefix: string
  copy: AiEmployeesCopy
  primary: string
  secondary: string[]
  onPrimaryChange: (value: string) => void
  onSecondaryChange: (value: string[]) => void
  disabled?: boolean
}) {
  const others = LOCALES.filter((tag) => tag !== primary)
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex-1">
        <Field id={`${idPrefix}-primary`} label={copy.form.primaryLocale}>
          <select
            id={`${idPrefix}-primary`}
            className={selectClass}
            value={primary}
            disabled={disabled}
            onChange={(e) => {
              onPrimaryChange(e.target.value)
              onSecondaryChange(secondary.filter((tag) => tag !== e.target.value))
            }}
          >
            {LOCALES.map((tag) => (
              <option key={tag} value={tag}>
                {copy.locales[tag]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <fieldset className="flex flex-1 flex-col gap-1.5" disabled={disabled}>
        <legend className="mb-1.5 text-sm font-medium text-foreground">{copy.form.secondaryLocales}</legend>
        {others.map((tag) => (
          <label key={tag} className="flex h-9 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={secondary.includes(tag)}
              onChange={(e) => onSecondaryChange(e.target.checked ? [...secondary, tag] : secondary.filter((t) => t !== tag))}
            />
            {copy.locales[tag]}
          </label>
        ))}
      </fieldset>
    </div>
  )
}
