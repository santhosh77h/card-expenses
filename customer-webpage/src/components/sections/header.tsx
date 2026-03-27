"use client";

import { Icons } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MobileDrawer } from "@/components/mobile-drawer";
import { easeInOutCubic } from "@/lib/animation";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function Header() {
  const tc = useTranslations("common");
  const [isVisible, setIsVisible] = useState(true);
  const [addBorder, setAddBorder] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const controls = useAnimation();

  useEffect(() => {
    let lastScrollY = 0;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsVisible(currentScrollY <= lastScrollY);
      setAddBorder(currentScrollY > 20);
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll);
    setIsInitialLoad(false);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    controls.start(isVisible ? "visible" : "hidden");
  }, [isVisible, controls]);

  const headerVariants = {
    hidden: { opacity: 0, y: "-100%" },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.header
          initial="hidden"
          animate={controls}
          exit="hidden"
          variants={headerVariants}
          transition={{
            duration: isInitialLoad ? 1 : 0.3,
            delay: isInitialLoad ? 0.5 : 0,
            ease: easeInOutCubic,
          }}
          className={cn(
            "sticky top-0 z-50 p-0 bg-background/60 backdrop-blur"
          )}
        >
          <div className="flex justify-between items-center container mx-auto p-2">
            <Link
              href="/"
              title="brand-logo"
              className="relative mr-6 flex items-center space-x-2"
            >
              <Icons.logo className="w-auto" />
              <span className="font-bold text-xl">{siteConfig.name}</span>
            </Link>
            <div className="hidden lg:flex items-center gap-3">
              <LanguageSwitcher />
              <Link href="#" className="flex-shrink-0">
                <img
                  src="/badges/download-black.svg"
                  alt={tc("downloadOnAppStore")}
                  className="h-10 dark:hidden block"
                />
                <img
                  src="/badges/download-white.svg"
                  alt={tc("downloadOnAppStore")}
                  className="h-10 hidden dark:block"
                />
              </Link>
            </div>
            <div className="mt-2 cursor-pointer block lg:hidden">
              <MobileDrawer />
            </div>
          </div>
          <motion.hr
            initial={{ opacity: 0 }}
            animate={{ opacity: addBorder ? 1 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="absolute w-full bottom-0"
          />
        </motion.header>
      )}
    </AnimatePresence>
  );
}
