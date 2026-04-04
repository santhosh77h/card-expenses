"use client";

import { Section } from "@/components/section";
import { CardAnalyticsPreview } from "@/components/ui/card-analytics-preview";
import { IPhoneFrame } from "@/components/ui/iphone-frame";
import { UploadScreenPreview } from "@/components/ui/upload-screen-preview";
import { easeOutCubic } from "@/lib/animation";
import { siteConfig } from "@/lib/config";
import { motion } from "framer-motion";
import { Globe, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TryDemoModal } from "@/components/try-demo-modal";
import { useTranslations } from "next-intl";
import { trackAppStoreClick, trackTryDemoClick } from "@/lib/analytics";
import { useState } from "react";

const fadeUp = (delay: number, y = 20) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: easeOutCubic },
});

export function Hero() {
  const t = useTranslations("hero");
  const tc = useTranslations("common");
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const trustSignals = [
    { icon: Lock, label: t("trustPrivacy") },
    { icon: Globe, label: t("trustAnyBank") },
  ];

  return (
    <Section id="hero" className="min-h-[90vh] w-full overflow-hidden">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center min-h-[80vh]">
          {/* Left side - text content */}
          <div className="lg:col-span-7 text-center lg:text-left pt-12 sm:pt-16 lg:pt-0">
            {/* Pill badge */}
            <motion.div {...fadeUp(0.1, 10)}>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <ShieldCheck className="h-4 w-4" />
                {t("badge")}
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              {...fadeUp(0.15)}
              className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter text-balance leading-[1.1]"
            >
              {t.rich("title", {
                highlight: (chunks) => (
                  <span className="text-primary">{chunks}</span>
                ),
              })}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              {...fadeUp(0.25)}
              className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 text-balance leading-relaxed"
            >
              {t("subtitle")}
            </motion.p>

            {/* Dual CTA */}
            <motion.div
              {...fadeUp(0.35)}
              className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4"
            >
              <a href={siteConfig.links.appStore} target="_blank" rel="noopener noreferrer" className="flex-shrink-0" onClick={() => trackAppStoreClick("hero")}>
                <img
                  src="/badges/download-black.svg"
                  alt={tc("downloadOnAppStore")}
                  className="h-12 dark:hidden block"
                />
                <img
                  src="/badges/download-white.svg"
                  alt={tc("downloadOnAppStore")}
                  className="h-12 hidden dark:block"
                />
              </a>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full"
                onClick={() => {
                  trackTryDemoClick();
                  setDemoModalOpen(true);
                }}
              >
                {t("tryDemo")}
              </Button>
            </motion.div>

            {/* Trust signals */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5, ease: easeOutCubic }}
              className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2"
            >
              {trustSignals.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Icon className="h-4 w-4 text-primary/70" />
                  <span>{label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right side - phone mockups */}
          <div className="lg:col-span-5 flex items-center justify-center relative py-8 lg:py-0">
            {/* Background glow */}
            <div
              className="absolute inset-0 -z-10"
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.765 0.177 163.2 / 0.06), transparent 70%)",
                filter: "blur(40px)",
              }}
            />

            {/* Back phone (Upload) - offset behind */}
            <motion.div
              initial={{ opacity: 0, x: 40, rotate: 0, scale: 0.85 }}
              animate={{ opacity: 0.85, x: 0, rotate: -6, scale: 0.9 }}
              transition={{ duration: 0.8, delay: 0.5, ease: easeOutCubic }}
              className="absolute -left-4 sm:left-0 lg:-left-6 -top-4 sm:-top-6 z-0"
            >
              <IPhoneFrame compact className="w-[200px] sm:w-[220px] lg:w-[240px]">
                <div className="h-[360px] sm:h-[400px] lg:h-[440px] overflow-hidden">
                  <UploadScreenPreview />
                </div>
              </IPhoneFrame>
            </motion.div>

            {/* Front phone (Analytics) - main */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: easeOutCubic }}
              className="relative z-10"
            >
              <IPhoneFrame className="w-[240px] sm:w-[280px] lg:w-[300px]">
                <div className="h-[440px] sm:h-[510px] lg:h-[550px] overflow-y-auto scrollbar-hide">
                  <CardAnalyticsPreview />
                </div>
              </IPhoneFrame>
            </motion.div>
          </div>
        </div>
      </div>

      <TryDemoModal open={demoModalOpen} onOpenChange={setDemoModalOpen} />
    </Section>
  );
}
