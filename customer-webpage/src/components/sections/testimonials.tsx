/* eslint-disable @next/next/no-img-element */
import { Section } from "@/components/section";
import { siteConfig } from "@/lib/config";
import { getTranslations } from "next-intl/server";

export async function Testimonials() {
  const t = await getTranslations("testimonials");

  return (
    <Section
      title={t("sectionTitle")}
      subtitle={t("sectionSubtitle")}
      className="container px-10 mx-auto"
    >
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4 py-10">
        {siteConfig.testimonials.map((testimonial) => {
          const text = t(`${testimonial.key}.text`);
          return (
            <div
              key={testimonial.key}
              className="bg-muted/60 overflow-hidden rounded-3xl flex flex-col h-fit"
              style={{
                gridRow: `span ${Math.floor(text.length / 50) + 1}`,
              }}
            >
              <div className="px-4 py-5 sm:p-6 flex-grow">
                <div className="flex items-center mb-4">
                  <img
                    className="h-10 w-10 rounded-full object-cover"
                    src={testimonial.image}
                    alt={testimonial.name}
                  />
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-foreground">
                      {testimonial.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t(`${testimonial.key}.role`)}
                    </p>
                  </div>
                </div>
                <p className="text-foreground">{text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
