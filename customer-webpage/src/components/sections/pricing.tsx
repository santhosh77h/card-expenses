"use client";

import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import { motion, useScroll, useTransform } from "framer-motion";
import { CheckIcon, ChevronRightIcon, Sparkles, Zap } from "lucide-react";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { trackPricingPlanClick } from "@/lib/analytics";

export function Pricing() {
  const t = useTranslations("pricing");
  const ref = useRef(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const trialOpacity = useTransform(scrollYProgress, [0, 0.08, 0.2], [0, 0, 1]);
  const trialY = useTransform(scrollYProgress, [0, 0.08, 0.2], [60, 60, 0]);

  const opacities = [
    useTransform(scrollYProgress, [0, 0.15, 0.3], [0, 0, 1]),
    useTransform(scrollYProgress, [0, 0.2, 0.35], [0, 0, 1]),
  ];

  const yTransforms = [
    useTransform(scrollYProgress, [0, 0.15, 0.3], [100, 100, 0]),
    useTransform(scrollYProgress, [0, 0.2, 0.35], [100, 100, 0]),
  ];

  return (
    <Section
      id="pricing"
      title={t("sectionTitle")}
      subtitle={t("sectionSubtitle")}
      className="container px-10 mx-auto max-w-[var(--max-container-width)]"
      ref={ref}
    >
      {/* Trial Banner */}
      <motion.div
        style={{ opacity: trialOpacity, y: trialY }}
        className="max-w-3xl mx-auto mb-8"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">
              {t("freeTrial")}
            </span>
          </div>
          <p className="text-lg font-semibold">
            {t("freeTrialDescription", {
              statements: siteConfig.trial.statements,
              days: siteConfig.trial.days,
            })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("noCreditCard")}
          </p>
        </div>
      </motion.div>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
        {siteConfig.pricing.map((plan, index) => (
          <motion.div
            key={plan.key}
            style={{ opacity: opacities[index], y: yTransforms[index] }}
            className={`relative bg-muted/60 p-6 rounded-3xl grid grid-rows-[auto_auto_1fr_auto] ${
              plan.isPopular ? "ring-2 ring-primary" : ""
            }`}
          >
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                  <Zap className="h-3 w-3" />
                  {t("bestValue")}
                </span>
              </div>
            )}
            <h2 className="text-2xl font-semibold mb-4">
              {t(`${plan.key}.name`)}
            </h2>
            <div className="text-4xl font-bold text-primary mb-2">
              {plan.price}
              <span className="text-sm font-normal text-muted-foreground">
                /{t(`per${plan.period === "month" ? "Month" : "Year"}`)}
              </span>
              {plan.key === "yearly" && (
                <span className="ml-2 text-sm font-medium text-primary/80">
                  {t("monthlyEquivalent")}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t(`${plan.key}.description`)}
            </p>

            <div className="space-y-3 mb-6">
              {siteConfig.pricingFeatureKeys.map((featureKey) => (
                <div key={featureKey} className="flex items-center">
                  <CheckIcon className="w-5 h-5 mr-2 text-primary flex-shrink-0" />
                  <span>{t(`features.${featureKey}`)}</span>
                </div>
              ))}
            </div>
            <Button
              variant="default"
              size="sm"
              className="rounded-full text-white"
              onClick={() => trackPricingPlanClick(plan.key)}
            >
              {t("startFreeTrial")}
              <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Top-up Credit Packs Note */}
      <motion.p
        style={{ opacity: opacities[1], y: yTransforms[1] }}
        className="text-center text-sm text-muted-foreground mt-8 max-w-xl mx-auto"
      >
        {t("topUpNote")}
      </motion.p>
    </Section>
  );
}
