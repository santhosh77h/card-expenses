import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className, hover }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-[#111827]/60 backdrop-blur-xl border border-[#1E293B]/50",
        hover && "transition-all duration-200 hover:border-[#00E5A0]/20 hover:bg-[#1F2937]/60",
        className
      )}
    >
      {children}
    </div>
  );
}
