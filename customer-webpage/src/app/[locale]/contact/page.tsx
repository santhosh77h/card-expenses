import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Mail, Clock } from "lucide-react";
import { siteConfig } from "@/lib/config";
import { ContactForm } from "@/components/contact-form";
import { SocialLinks } from "@/components/social-links";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "en"
          ? `${siteConfig.url}/contact`
          : `${siteConfig.url}/${locale}/contact`,
    },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");

  const contactJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: t("title"),
    description: t("description"),
    url: `${siteConfig.url}/contact`,
    mainEntity: {
      "@type": "Organization",
      name: "Vector Expense",
      email: siteConfig.links.email,
      url: siteConfig.url,
    },
  };

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-4 py-20">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors mb-12"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToHome")}
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">
            {t("title")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            {t("description")}
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Form column */}
          <div className="lg:col-span-3">
            <ContactForm />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-6">
            {/* Email card */}
            <div className="rounded-xl border border-border bg-muted/40 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t("sidebar.emailTitle")}
                </h3>
              </div>
              <a
                href={`mailto:${siteConfig.links.email}`}
                className="text-sm text-primary hover:underline underline-offset-4 break-all"
              >
                {siteConfig.links.email}
              </a>
            </div>

            {/* Response time */}
            <div className="rounded-xl border border-border bg-muted/40 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("sidebar.responseTime")}
                </p>
              </div>
            </div>

            {/* Social links */}
            <div className="rounded-xl border border-border bg-muted/40 p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {t("sidebar.socialTitle")}
              </h3>
              <SocialLinks />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
