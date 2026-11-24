"use client"

import {
  Accordion as AccordionRoot,
  AccordionHeader,
  AccordionItem as AccordionItemPrimitive,
  AccordionPanel,
  AccordionTrigger as AccordionTriggerPrimitive,
} from "@ui-sdk/react/accordion"
import { ChevronDownIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"

type WithClass<T> = Omit<T, "className"> & { className?: string }

function Accordion({ className, ...props }: WithClass<ComponentProps<typeof AccordionRoot>>) {
  return <AccordionRoot className={cn("flex w-full flex-col", className)} {...props} />
}

function AccordionItem({ className, ...props }: WithClass<ComponentProps<typeof AccordionItemPrimitive>>) {
  return <AccordionItemPrimitive className={cn("border-b last:border-b-0", className)} {...props} />
}

function AccordionTrigger({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <AccordionHeader className="flex">
      <AccordionTriggerPrimitive
        className={cn(
          "group flex flex-1 items-start justify-between gap-4 rounded-lg py-4 text-left font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-disabled:opacity-50",
          className,
        )}
      >
        {children}
        <ChevronDownIcon
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-(--ease-out) group-data-open:rotate-180"
        />
      </AccordionTriggerPrimitive>
    </AccordionHeader>
  )
}

function AccordionContent({ className, children }: { className?: string; children: ReactNode }) {
  return (
    // Closed answers stay in the HTML, so find in page, search engines and agents can read them.
    <AccordionPanel hiddenUntilFound className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-250 ease-(--ease-out) data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
      <div className={cn("pb-5", className)}>{children}</div>
    </AccordionPanel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
