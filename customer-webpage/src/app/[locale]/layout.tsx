import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";
import { locales, localeToOgLocale, type Locale } from "@/i18n/config";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const alternateLanguages: Record<string, string> = {};
  for (const l of locales) {
    alternateLanguages[l] = l === "en" ? siteConfig.url : `${siteConfig.url}/${l}`;
  }
  alternateLanguages["x-default"] = siteConfig.url;

  return {
    title: `${siteConfig.name} | ${siteConfig.description}`,
    description:
      "Privacy-first credit card statement parser. Upload a PDF, get instant spending insights - no data ever stored on our servers. Works with any bank that issues a PDF statement.",
    keywords: siteConfig.keywords,
    openGraph: {
      title: `${siteConfig.name} - ${siteConfig.description}`,
      description:
        "Privacy-first credit card statement parser. Upload a PDF, get instant spending insights.",
      type: "website",
      locale: localeToOgLocale[locale as Locale] || "en_US",
      alternateLocale: locales
        .filter((l) => l !== locale)
        .map((l) => localeToOgLocale[l]),
      siteName: siteConfig.name,
      url: siteConfig.url,
    },
    twitter: {
      card: "summary_large_image",
      title: `${siteConfig.name} - ${siteConfig.description}`,
      description:
        "Privacy-first credit card statement parser. Upload a PDF, get instant spending insights.",
    },
    robots: {
      index: true,
      follow: true,
    },
    icons: "/favicon.ico",
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical:
        locale === "en" ? siteConfig.url : `${siteConfig.url}/${locale}`,
      languages: alternateLanguages,
    },
  };
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-R1K3YW8Q6G"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-R1K3YW8Q6G');
        `}
      </Script>
      <body
        className={cn(
          `${geistSans.variable} ${geistMono.variable}`,
          "min-h-screen bg-background antialiased w-full mx-auto scroll-smooth font-sans"
        )}
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
          >
            {children}
            <ThemeToggle />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
