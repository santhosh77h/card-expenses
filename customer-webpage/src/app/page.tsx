import { Benefits } from "@/components/sections/benefits";
import { BentoGrid } from "@/components/sections/bento";
import { CTA } from "@/components/sections/cta";
import { FAQ } from "@/components/sections/faq";
import { FeatureHighlight } from "@/components/sections/feature-highlight";
import { FeatureScroll } from "@/components/sections/feature-scroll";
import { Features } from "@/components/sections/features";
import { Footer } from "@/components/sections/footer";
import { Header } from "@/components/sections/header";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Pricing } from "@/components/sections/pricing";
import { siteConfig } from "@/lib/config";
import { FAQ_DATA } from "@/lib/constants";

const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Vector Expense",
  applicationCategory: "FinanceApplication",
  operatingSystem: "iOS, Android",
  description:
    "Privacy-first credit card statement parser. Upload a PDF, get instant spending insights. Your PII is never saved on our servers.",
  offers: [
    {
      "@type": "Offer",
      price: "3",
      priceCurrency: "USD",
      description: "Monthly plan — 8 statement parses per month",
    },
    {
      "@type": "Offer",
      price: "24",
      priceCurrency: "USD",
      description: "Yearly plan — 12 statement parses per month",
    },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_DATA.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Vector Expense",
  url: siteConfig.url,
  description: "Privacy-first credit card statement parser.",
};

export default function Home() {
  return (
    <main className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd),
        }}
      />
      <Header />
      <Hero />
      <HowItWorks />
      <FeatureScroll />
      <FeatureHighlight />
      <BentoGrid />
      <Benefits />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
