"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BorderBeam } from "@/components/ui/border-beam";
import { NumberTicker } from "@/components/ui/number-ticker";
import { siteConfig } from "@/lib/config";
import { trackAppStoreClick } from "@/lib/analytics";
import { useTranslations } from "next-intl";

interface TryDemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TryDemoModal({ open, onOpenChange }: TryDemoModalProps) {
  const t = useTranslations("tryDemoModal");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <BorderBeam
          size={80}
          duration={6}
          colorFrom="oklch(0.765 0.177 163.2)"
          colorTo="oklch(0.765 0.177 163.2 / 0.3)"
        />

        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-center">
            <span className="flex items-center justify-center gap-1.5 text-2xl font-bold text-primary mt-2">
              <NumberTicker value={siteConfig.trial.statements} className="text-primary" />
              <span className="text-base font-medium text-muted-foreground">
                {t("freeParses", { count: "" }).trim()}
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          {t("description")}
        </p>

        <div className="flex flex-col items-center gap-3 pt-2">
          <a
            href={siteConfig.links.appStore}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackAppStoreClick("try_demo_modal")}
          >
            <img
              src="/badges/download-black.svg"
              alt={t("downloadCta")}
              className="h-12 dark:hidden block"
            />
            <img
              src="/badges/download-white.svg"
              alt={t("downloadCta")}
              className="h-12 hidden dark:block"
            />
          </a>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px w-8 bg-border" />
            {t("or")}
            <span className="h-px w-8 bg-border" />
          </div>

          <a
            href="#feature-highlight"
            onClick={() => onOpenChange(false)}
            className="text-sm text-primary hover:underline underline-offset-4"
          >
            {t("learnMore")}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
