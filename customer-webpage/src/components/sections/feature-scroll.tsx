"use client";

import { Section } from "@/components/section";
import { CategoriesScreenPreview } from "@/components/ui/categories-screen-preview";
import { IPhoneFrame } from "@/components/ui/iphone-frame";
import { TransactionsScreenPreview } from "@/components/ui/transactions-screen-preview";
import { UploadScreenPreview } from "@/components/ui/upload-screen-preview";
import { easeOutCubic } from "@/lib/animation";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useTranslations } from "next-intl";

export function FeatureScroll() {
  const t = useTranslations("featureScroll");
  const phone1Ref = useRef(null);
  const phone2Ref = useRef(null);
  const phone3Ref = useRef(null);

  const { scrollYProgress: scrollYProgress1 } = useScroll({
    target: phone1Ref,
    offset: ["start end", "end start"],
  });

  const { scrollYProgress: scrollYProgress2 } = useScroll({
    target: phone2Ref,
    offset: ["start end", "end start"],
  });

  const { scrollYProgress: scrollYProgress3 } = useScroll({
    target: phone3Ref,
    offset: ["start end", "end start"],
  });

  const y1 = useTransform(scrollYProgress1, [0, 0.3], [150, 0], {
    ease: easeOutCubic,
  });
  const y2 = useTransform(scrollYProgress2, [0.1, 0.4], [200, 0], {
    ease: easeOutCubic,
  });
  const y3 = useTransform(scrollYProgress3, [0.2, 0.5], [250, 0], {
    ease: easeOutCubic,
  });

  return (
    <Section
      id="feature-scroll"
      title={t("sectionTitle")}
      subtitle={t("sectionSubtitle")}
      className="container px-4 sm:px-10 mx-auto max-w-[var(--max-container-width)]"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mx-auto select-none">
        <motion.div
          ref={phone1Ref}
          className="-z-10 max-w-[320px] mx-auto"
          style={{ y: y1 }}
        >
          <IPhoneFrame className="w-[320px]">
            <div className="h-[580px] overflow-hidden">
              <UploadScreenPreview />
            </div>
          </IPhoneFrame>
        </motion.div>
        <motion.div
          ref={phone2Ref}
          className="-z-10 max-w-[320px] mx-auto"
          style={{ y: y2 }}
        >
          <IPhoneFrame className="w-[320px]">
            <div className="h-[580px] overflow-hidden">
              <CategoriesScreenPreview />
            </div>
          </IPhoneFrame>
        </motion.div>
        <motion.div
          ref={phone3Ref}
          className="-z-10 max-w-[320px] mx-auto"
          style={{ y: y3 }}
        >
          <IPhoneFrame className="w-[320px]">
            <div className="h-[580px] overflow-hidden">
              <TransactionsScreenPreview />
            </div>
          </IPhoneFrame>
        </motion.div>
      </div>
    </Section>
  );
}
