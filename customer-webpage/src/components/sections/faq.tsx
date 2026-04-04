import { Section } from "@/components/section";
import { TrackedFaqAccordion } from "@/components/tracked-faq-accordion";
import { siteConfig } from "@/lib/config";
import { getTranslations } from "next-intl/server";

export async function FAQ() {
  const t = await getTranslations("faq");

  const items = siteConfig.faqKeys.map((key) => ({
    key,
    question: t(`${key}.question`),
    answer: t(`${key}.answer`),
  }));

  return (
    <Section
      id="faq"
      title={t("sectionTitle")}
      subtitle={t("sectionSubtitle")}
      className="container px-10 mx-auto max-w-[var(--max-container-width)]"
    >
      <TrackedFaqAccordion items={items} />
    </Section>
  );
}
