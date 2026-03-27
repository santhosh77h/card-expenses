import { Section } from "@/components/section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { siteConfig } from "@/lib/config";
import { getTranslations } from "next-intl/server";

export async function FAQ() {
  const t = await getTranslations("faq");

  return (
    <Section
      id="faq"
      title={t("sectionTitle")}
      subtitle={t("sectionSubtitle")}
      className="container px-10 mx-auto max-w-[var(--max-container-width)]"
    >
      <Accordion
        type="single"
        collapsible
        className="w-full max-w-2xl mx-auto py-10"
      >
        {siteConfig.faqKeys.map((key) => (
          <AccordionItem key={key} value={key}>
            <AccordionTrigger className="text-left hover:no-underline">
              {t(`${key}.question`)}
            </AccordionTrigger>
            <AccordionContent>{t(`${key}.answer`)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}
