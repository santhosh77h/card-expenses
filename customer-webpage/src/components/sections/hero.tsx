"use client";

import { Icons } from "@/components/icons";
import { Section } from "@/components/section";
import { CardAnalyticsPreview } from "@/components/ui/card-analytics-preview";
import { CategoriesScreenPreview } from "@/components/ui/categories-screen-preview";
import { IPhoneFrame } from "@/components/ui/iphone-frame";
import { TransactionsScreenPreview } from "@/components/ui/transactions-screen-preview";
import { UploadScreenPreview } from "@/components/ui/upload-screen-preview";
import { easeInOutCubic } from "@/lib/animation";
import { siteConfig } from "@/lib/config";
import { motion, useScroll, useTransform } from "framer-motion";

export function Hero() {
  const { scrollY } = useScroll({
    offset: ["start start", "end start"],
  });
  const y1 = useTransform(scrollY, [0, 300], [100, 0]);
  const y2 = useTransform(scrollY, [0, 300], [50, 0]);
  const y3 = useTransform(scrollY, [0, 300], [0, 0]);
  const y4 = useTransform(scrollY, [0, 300], [50, 0]);
  const y5 = useTransform(scrollY, [0, 300], [100, 0]);

  return (
    <Section id="hero" className="min-h-[100vh] w-full overflow-hidden">
      <main className="mx-auto pt-16 sm:pt-24 md:pt-32 text-center relative px-4">
        <div className="relative">
          <motion.div
            initial={{ scale: 4.5, height: "80vh" }}
            animate={{ scale: 1, height: "10vh" }}
            transition={{
              scale: { delay: 0, duration: 1.8, ease: easeInOutCubic },
              height: { delay: 0, duration: 1.8, ease: easeInOutCubic },
            }}
            className="mb-16 relative z-20"
            style={{ transformOrigin: "top" }}
          >
            <div className="h-20 w-20 flex items-center justify-center rounded-3xl mx-auto shadow-md overflow-hidden">
              <Icons.logo className="w-20 h-20 rounded-3xl" />
            </div>
          </motion.div>
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="absolute inset-0 top-20 z-10"
          >
            {siteConfig.name}
          </motion.div>
        </div>

        <div className="max-w-5xl mx-auto">
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5, ease: easeInOutCubic }}
            className="text-5xl font-bold mb-4 tracking-tighter"
          >
            {siteConfig.description}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.7, ease: easeInOutCubic }}
            className="max-w-2xl mx-auto text-xl mb-8 font-medium text-balance text-muted-foreground"
          >
            Upload your credit card statement PDF, get instant AI-powered
            spending insights. Privacy-first — no data ever stored on our
            servers.
          </motion.p>
          <div className="flex justify-center mb-16">
            <motion.a
              href="#"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1 }}
              className="flex-shrink-0"
            >
              <img
                src="/badges/download-black.svg"
                alt="Download on the App Store"
                className="w-40 dark:hidden block"
              />
              <img
                src="/badges/download-white.svg"
                alt="Download on the App Store"
                className="w-40 hidden dark:block"
              />
            </motion.a>
          </div>
        </div>
        <div className="flex flex-nowrap items-center justify-center gap-4 sm:gap-6 h-auto sm:h-[680px] select-none">
          <motion.div
            initial={{ opacity: 0, x: -200 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ y: y1 }}
            transition={{ duration: 1, delay: 1 }}
            className="flex-shrink-0"
          >
            <IPhoneFrame compact className="w-[180px] sm:w-[320px]">
              <div className="h-[350px] sm:h-[540px] overflow-hidden">
                <img
                  src="/screenshots/home.svg"
                  alt="Vector Expense Home"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </IPhoneFrame>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ y: y2 }}
            transition={{ duration: 1, delay: 1 }}
            className="flex-shrink-0"
          >
            <IPhoneFrame compact className="w-[180px] sm:w-[320px]">
              <div className="h-[350px] sm:h-[540px] overflow-hidden">
                <UploadScreenPreview />
              </div>
            </IPhoneFrame>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ y: y3 }}
            transition={{ duration: 1, delay: 1 }}
            className="flex-shrink-0"
          >
            <IPhoneFrame className="w-[200px] sm:w-[320px] z-10">
              <div className="h-[390px] sm:h-[580px] overflow-hidden">
                <CardAnalyticsPreview />
              </div>
            </IPhoneFrame>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ y: y4 }}
            transition={{ duration: 1, delay: 1 }}
            className="flex-shrink-0"
          >
            <IPhoneFrame compact className="w-[180px] sm:w-[320px]">
              <div className="h-[350px] sm:h-[540px] overflow-hidden">
                <CategoriesScreenPreview />
              </div>
            </IPhoneFrame>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 200 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ y: y5 }}
            transition={{ duration: 1, delay: 1 }}
            className="flex-shrink-0"
          >
            <IPhoneFrame compact className="w-[180px] sm:w-[320px]">
              <div className="h-[350px] sm:h-[540px] overflow-hidden">
                <TransactionsScreenPreview />
              </div>
            </IPhoneFrame>
          </motion.div>
        </div>
      </main>
    </Section>
  );
}
