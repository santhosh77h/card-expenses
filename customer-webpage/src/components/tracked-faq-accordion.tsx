"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { trackFaqOpen } from "@/lib/analytics";

export function TrackedFaqAccordion({
  items,
}: {
  items: { key: string; question: string; answer: string }[];
}) {
  return (
    <Accordion
      type="single"
      collapsible
      className="w-full max-w-2xl mx-auto py-10"
      onValueChange={(value) => {
        if (value) trackFaqOpen(value);
      }}
    >
      {items.map((item) => (
        <AccordionItem key={item.key} value={item.key}>
          <AccordionTrigger className="text-left hover:no-underline">
            {item.question}
          </AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
