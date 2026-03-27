import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors mb-12"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          {t("backToHome")}
        </Link>

        <h1 className="text-4xl font-bold text-foreground mb-2">{t("title")}</h1>
        <p className="text-muted-foreground mb-12">{t("lastUpdated")}</p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">{t("corePrinciple.title")}</h2>
            <p>{t.rich("corePrinciple.content", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">{t("dataProcessing.title")}</h2>
            <ul className="space-y-4 list-none">
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("dataProcessing.pdfProcessing", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("dataProcessing.localStorage", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("dataProcessing.noCloudSync", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">{t("notCollected.title")}</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>{t("notCollected.item1")}</li>
              <li>{t("notCollected.item2")}</li>
              <li>{t("notCollected.item3")}</li>
              <li>{t("notCollected.item4")}</li>
              <li>{t("notCollected.item5")}</li>
              <li>{t("notCollected.item6")}</li>
              <li>{t("notCollected.item7")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">{t("thirdParty.title")}</h2>
            <p>{t("thirdParty.content")}</p>
            <p className="mt-3">{t("thirdParty.aiNote")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">{t("dataRetention.title")}</h2>
            <p>{t("dataRetention.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">{t("security.title")}</h2>
            <p>{t("security.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">{t("children.title")}</h2>
            <p>{t("children.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">{t("changes.title")}</h2>
            <p>{t("changes.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">{t("contact.title")}</h2>
            <p>{t("contact.content")}</p>
            <p className="mt-3"><a href="mailto:privacy@vectorexpense.com" className="text-primary hover:text-primary/80 transition-colors underline underline-offset-4">privacy@vectorexpense.com</a></p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>{t("tagline")}</p>
        </div>
      </div>
    </main>
  );
}
