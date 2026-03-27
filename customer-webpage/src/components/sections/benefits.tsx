/* eslint-disable @next/next/no-img-element */
"use client";

import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef } from "react";
import { useTranslations } from "next-intl";

export function Benefits() {
  const t = useTranslations("benefits");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollPrev = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const scrollNext = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  return (
    <Section
      title={t("sectionTitle")}
      subtitle={t("sectionSubtitle", { name: siteConfig.name })}
      className="bg-muted relative max-w-screen"
    >
      <div
        ref={scrollContainerRef}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="hidden md:block flex-shrink-0 w-[calc(90%-1rem)] md:w-1/3 lg:w-1/3 xl:w-1/4 snap-start select-none px-4"
          aria-hidden="true"
        />
        {siteConfig.benefits.map((benefit) => {
          const text = t(`item${benefit.id}`);
          return (
            <div
              key={benefit.id}
              className="flex-shrink-0 w-[calc(90%-1rem)] md:w-1/3 lg:w-1/3 xl:w-1/4 snap-center md:snap-start select-none px-4"
            >
              <div className="h-[500px] relative rounded-xl overflow-hidden">
                <img
                  src={benefit.image}
                  alt={text}
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-out object-[0px_10px] hover:object-top"
                />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-muted to-transparent pointer-events-none" />
              </div>
              <div className="mt-4">
                <h2 className="text-balance text-xl tracking-tight font-semibold leading-[1.25] text-left text-foreground/80 dark:text-foreground/90">
                  {text}
                </h2>
              </div>
            </div>
          );
        })}
        <div
          className="hidden md:block flex-shrink-0 w-1/3 lg:w-1/3 xl:w-1/4 snap-start"
          aria-hidden="true"
        />
      </div>
      <div className="flex justify-center md:justify-end mt-4 md:mt-8 md:pr-32">
        <div className="flex gap-4">
          <Button
            onClick={scrollPrev}
            className="size-8 rounded-full"
            variant="outline"
            size="icon"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">{t("previousSlide")}</span>
          </Button>
          <Button
            onClick={scrollNext}
            className="size-8 rounded-full"
            variant="outline"
            size="icon"
          >
            <ArrowRight className="h-4 w-4" />
            <span className="sr-only">{t("nextSlide")}</span>
          </Button>
        </div>
      </div>
    </Section>
  );
}
