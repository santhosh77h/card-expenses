import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/config";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("terms");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "en"
          ? `${siteConfig.url}/terms`
          : `${siteConfig.url}/${locale}/terms`,
    },
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("terms");

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors mb-12"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          {t("backToHome")}
        </Link>

        <h1 className="text-4xl font-bold text-foreground mb-2">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mb-12">
          {t("lastUpdated")}
        </p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">
          {/* 1. Acceptance of Terms */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("acceptance.title")}
            </h2>
            <p>{t("acceptance.content")}</p>
          </section>

          {/* 2. Description of Service */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("description.title")}
            </h2>
            <p>{t("description.content")}</p>
          </section>

          {/* 3. User Responsibilities */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("responsibilities.title")}
            </h2>
            <ul className="space-y-3 list-none">
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("responsibilities.ownership", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("responsibilities.accurateUse", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("responsibilities.lawfulUse", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
            </ul>
          </section>

          {/* 4. Free Trial */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("freeTrial.title")}
            </h2>
            <p>{t("freeTrial.intro")}</p>
            <ul className="mt-4 space-y-2 list-disc list-inside text-muted-foreground">
              <li>
                {t.rich("freeTrial.parses", { highlight: (chunks) => <span className="text-primary font-medium">{chunks}</span> })}
              </li>
              <li>{t("freeTrial.noCreditCard")}</li>
              <li>{t("freeTrial.fullAccess")}</li>
              <li>{t("freeTrial.anyBank")}</li>
            </ul>
            <p className="mt-4">{t("freeTrial.expiry")}</p>
          </section>

          {/* 5. Free Features */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("freeFeatures.title")}
            </h2>
            <p>{t("freeFeatures.intro")}</p>
            <ul className="mt-4 space-y-2 list-disc list-inside text-muted-foreground">
              <li>{t("freeFeatures.manualEntry")}</li>
              <li>{t("freeFeatures.demoMode")}</li>
              <li>{t("freeFeatures.offlineAccess")}</li>
              <li>{t("freeFeatures.charts")}</li>
              <li>{t("freeFeatures.csvExport")}</li>
            </ul>
          </section>

          {/* 6. Pro Subscription */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("proSubscription.title")}
            </h2>
            <p className="mb-4">{t("proSubscription.intro")}</p>
            <div className="p-4 rounded-lg bg-muted border border-border mb-4">
              <ul className="space-y-2 list-none">
                <li>
                  {t.rich("proSubscription.monthly", {
                    bold: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                    highlight: (chunks) => <span className="text-primary font-medium">{chunks}</span>,
                  })}
                </li>
                <li>
                  {t.rich("proSubscription.yearly", {
                    bold: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                    highlight: (chunks) => <span className="text-primary font-medium">{chunks}</span>,
                  })}
                </li>
              </ul>
            </div>
            <ul className="space-y-3 list-none">
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("proSubscription.allowance", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("proSubscription.payment", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("proSubscription.cancellation", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("proSubscription.priceChanges", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
            </ul>
          </section>

          {/* 7. Pay-As-You-Go Credits */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("credits.title")}
            </h2>
            <p className="mb-4">{t("credits.intro")}</p>
            <div className="p-4 rounded-lg bg-muted border border-border mb-4">
              <ul className="space-y-2 list-none">
                <li>
                  {t.rich("credits.pack30", {
                    bold: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                    highlight: (chunks) => <span className="text-primary font-medium">{chunks}</span>,
                  })}
                </li>
                <li>
                  {t.rich("credits.pack70", {
                    bold: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                    highlight: (chunks) => <span className="text-primary font-medium">{chunks}</span>,
                  })}
                </li>
              </ul>
            </div>
            <ul className="space-y-3 list-none">
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("credits.noExpiry", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("credits.consumptionOrder", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                {t.rich("credits.nonRefundable", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </li>
            </ul>
          </section>

          {/* 8. Apple App Store Terms */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("appStore.title")}
            </h2>
            <p>
              {t.rich("appStore.content", {
                appleLink: (chunks) => (
                  <a
                    href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors underline underline-offset-4"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </section>

          {/* 9. Intellectual Property */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("ip.title")}
            </h2>
            <p>{t("ip.content")}</p>
          </section>

          {/* 10. Disclaimer of Warranties */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("warranties.title")}
            </h2>
            <div className="p-4 rounded-lg bg-muted border border-border">
              <p>
                {t.rich("warranties.content", { bold: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </p>
              <p className="mt-3">{t("warranties.accuracy")}</p>
            </div>
          </section>

          {/* 11. Limitation of Liability */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("liability.title")}
            </h2>
            <p>{t("liability.content")}</p>
            <p className="mt-3">{t("liability.verification")}</p>
          </section>

          {/* 12. Data & Privacy */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("dataPrivacy.title")}
            </h2>
            <p>
              {t.rich("dataPrivacy.content", {
                privacyLink: (chunks) => (
                  <Link
                    href="/privacy"
                    className="text-primary hover:text-primary/80 transition-colors underline underline-offset-4"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </section>

          {/* 13. Termination */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("termination.title")}
            </h2>
            <p>{t("termination.content")}</p>
          </section>

          {/* 14. Changes to Terms */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("changesToTerms.title")}
            </h2>
            <p>{t("changesToTerms.content")}</p>
          </section>

          {/* 15. Governing Law */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("governingLaw.title")}
            </h2>
            <p>{t("governingLaw.content")}</p>
          </section>

          {/* 16. Contact */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("contact.title")}
            </h2>
            <p>{t("contact.content")}</p>
            <p className="mt-3">
              <a
                href="mailto:legal@vectorexpense.com"
                className="text-primary hover:text-primary/80 transition-colors underline underline-offset-4"
              >
                legal@vectorexpense.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>{t("tagline")}</p>
        </div>
      </div>
    </main>
  );
}
