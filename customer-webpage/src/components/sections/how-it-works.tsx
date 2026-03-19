"use client";

import { Section } from "@/components/section";
import { HOW_IT_WORKS } from "@/lib/constants";
import { motion, useScroll, useTransform } from "framer-motion";
import { Upload, Cpu, BarChart3 } from "lucide-react";
import { useRef } from "react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  upload: Upload,
  cpu: Cpu,
  "bar-chart": BarChart3,
};

export function HowItWorks() {
  const ref = useRef(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.25], [0, 0, 1]);
  const y = useTransform(scrollYProgress, [0, 0.1, 0.25], [60, 60, 0]);

  return (
    <Section
      id="how-it-works"
      title="How It Works"
      subtitle="Three simple steps"
      className="container px-10 mx-auto max-w-[var(--max-container-width)]"
      ref={ref}
    >
      <motion.div
        style={{ opacity, y }}
        className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto py-10"
      >
        {HOW_IT_WORKS.map((step) => {
          const Icon = iconMap[step.icon] || Upload;
          return (
            <div
              key={step.step}
              className="flex flex-col items-center text-center gap-4"
            >
              <div className="relative">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <span className="absolute -top-2 -right-2 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-sm font-bold">
                  {step.step}
                </span>
              </div>
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                {step.description}
              </p>
            </div>
          );
        })}
      </motion.div>
    </Section>
  );
}
