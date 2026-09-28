import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Section, SectionHeader } from '@/components/site/primitives'
import { JsonLd } from './breadcrumbs'

export type FaqEntry = { question: string; answer: string }

export function FaqList({ items, idPrefix = 'faq' }: { items: FaqEntry[]; idPrefix?: string }) {
  return (
    <Accordion className="w-full rounded-2xl border bg-card px-5">
      {items.map((item, i) => (
        <AccordionItem key={item.question} value={`${idPrefix}-${i}`}>
          <AccordionTrigger className="py-5 text-left text-base font-semibold hover:no-underline">{item.question}</AccordionTrigger>
          <AccordionContent className="pb-5 leading-relaxed text-muted-foreground">{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

export function FaqSection({
  eyebrow,
  title,
  description,
  items,
  tone = 'default',
  structuredData = true,
}: {
  eyebrow?: string
  title: string
  description?: string
  items: FaqEntry[]
  tone?: 'default' | 'muted'
  structuredData?: boolean
}) {
  if (items.length === 0) return null
  return (
    <Section tone={tone} labelledBy="faq-title">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeader id="faq-title" eyebrow={eyebrow} title={title} description={description} />
        <FaqList items={items} />
      </div>
      {structuredData && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: items.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          }}
        />
      )}
    </Section>
  )
}
