"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FaqItem {
  question: string;
  answer: string;
}

export default function BlogFaq({ faq }: { faq: FaqItem[] }) {
  if (!faq || faq.length === 0) return null;

  return (
    <div className="my-10 rounded-lg border border-border bg-card/50 p-6">
      <h2 className="text-lg font-semibold mb-4 text-foreground">
        Questions answered in this article
      </h2>
      <Accordion type="single" collapsible className="w-full">
        {faq.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="text-left text-sm font-medium text-foreground">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
