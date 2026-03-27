import { Section } from "@/components/section";
import { siteConfig } from "@/lib/config";
import { getTranslations } from "next-intl/server";

export async function Features() {
  const t = await getTranslations("features");

  return (
    <Section
      id="features"
      title={t("sectionTitle")}
      subtitle={t("sectionSubtitle")}
      className="max-w-screen-lg mx-auto container px-10"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {siteConfig.featureKeys.map((f) => (
          <div
            key={f.key}
            className="rounded-lg overflow-hidden bg-card p-6 flex flex-col items-center text-center"
          >
            <div className="flex flex-col items-center gap-y-4 mb-4">
              <div className="bg-gradient-to-b from-primary to-primary/80 p-2 rounded-lg text-white">
                {f.icon}
              </div>
              <h2 className="text-xl font-semibold text-card-foreground">
                {t(`${f.key}.name`)}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t(`${f.key}.description`)}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
