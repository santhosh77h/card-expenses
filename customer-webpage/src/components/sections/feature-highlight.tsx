/* eslint-disable @next/next/no-img-element */
"use client";

import { Section } from "@/components/section";
import { CardAnalyticsPreview } from "@/components/ui/card-analytics-preview";
import { CategoriesScreenPreview } from "@/components/ui/categories-screen-preview";
import { IPhoneFrame } from "@/components/ui/iphone-frame";
import { TransactionsScreenPreview } from "@/components/ui/transactions-screen-preview";
import { UploadScreenPreview } from "@/components/ui/upload-screen-preview";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const previewComponents: Record<string, { component: React.ReactNode; scrollable?: boolean }> = {
  "card-analytics": { component: <CardAnalyticsPreview />, scrollable: true },
  "upload-screen": { component: <UploadScreenPreview /> },
  "categories-screen": { component: <CategoriesScreenPreview />, scrollable: true },
  "transactions-screen": { component: <TransactionsScreenPreview />, scrollable: true },
};

interface FeatureProps {
  title: string;
  description: string;
  imageSrc: string;
  direction: "ltr" | "rtl";
  isActive: boolean;
  previewId?: string;
}

function Feature({
  title,
  description,
  imageSrc,
  direction,
  isActive,
  previewId,
}: FeatureProps) {
  const isLTR = direction === "ltr";
  const textVariants = {
    hidden: { opacity: 0, x: isLTR ? -20 : 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.5,
        ease: [0, 0, 0.58, 1] as const,
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: isLTR ? -10 : 10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        ease: [0, 0, 0.58, 1] as const,
      },
    },
  };

  const preview = previewId ? previewComponents[previewId] : null;

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-between pb-10 transition-all duration-500 ease-out",
        isLTR ? "lg:flex-row" : "lg:flex-row-reverse"
      )}
    >
      <motion.div
        className={cn(
          "w-full lg:w-1/2 mb-10 lg:mb-0",
          isLTR ? "lg:pr-8" : "lg:pl-8"
        )}
        initial="hidden"
        animate={isActive ? "visible" : "hidden"}
        variants={textVariants}
      >
        <div className="flex flex-col gap-4 max-w-sm text-center lg:text-left mx-auto">
          <motion.h2
            className="text-4xl md:text-5xl lg:text-6xl font-bold"
            variants={itemVariants}
          >
            {title}
          </motion.h2>
          <motion.p className="text-xl md:text-2xl" variants={itemVariants}>
            {description}
          </motion.p>
          <motion.div variants={itemVariants}>
            <Link href="#" className="inline-block mx-auto lg:mx-0">
              <img
                src="/badges/download-black.svg"
                alt="Download on the App Store"
                className="h-12 dark:hidden block"
              />
              <img
                src="/badges/download-white.svg"
                alt="Download on the App Store"
                className="h-12 hidden dark:block"
              />
            </Link>
          </motion.div>
        </div>
      </motion.div>
      <div className="w-full lg:w-1/2 flex justify-center">
        <IPhoneFrame className="w-[320px]">
          {preview ? (
            <div className={cn("h-[580px]", preview.scrollable ? "overflow-y-auto scrollbar-hide" : "overflow-hidden")}>
              {preview.component}
            </div>
          ) : (
            <div className="h-[580px] overflow-hidden">
              <img
                src={imageSrc}
                alt={title}
                className="w-full h-full object-cover object-top"
              />
            </div>
          )}
        </IPhoneFrame>
      </div>
    </motion.div>
  );
}

export function FeatureHighlight() {
  const features = siteConfig.featureHighlight;

  const [activeFeature, setActiveFeature] = useState(-1);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const container = containerRef.current;
      if (container) {
        const { top, bottom } = container.getBoundingClientRect();
        const middleOfScreen = window.innerHeight / 2;
        const featureHeight = (bottom - top) / features.length;

        const activeIndex = Math.floor((middleOfScreen - top) / featureHeight);
        setActiveFeature(
          Math.max(-1, Math.min(features.length - 1, activeIndex))
        );
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [features.length]);

  return (
    <Section
      id="feature-highlight"
      title="Features"
      subtitle="Powerful features"
      className="container px-10 mx-auto max-w-[var(--max-container-width)]"
      ref={containerRef}
    >
      {features.map((feature, index) => (
        <Feature key={index} isActive={activeFeature === index} {...feature} />
      ))}
    </Section>
  );
}
