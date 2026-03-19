import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { Icons } from "@/components/icons";

export function CTA() {
  return (
    <section id="cta">
      <div className="py-14">
        <div className="container flex w-full flex-col items-center justify-center p-4 mx-auto max-w-[var(--max-container-width)]">
          <div className="relative flex w-full max-w-[1000px] flex-col items-center justify-center overflow-hidden rounded-[2rem] border p-10 py-14">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 50%, oklch(0.765 0.177 163.2 / 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 50%, oklch(0.765 0.177 163.2 / 0.06) 0%, transparent 50%)",
              }}
            />

            <div className="z-10 mx-auto size-24 rounded-[2rem] border bg-white/10 shadow-2xl backdrop-blur-md dark:bg-black/10 lg:size-32 overflow-hidden">
              <Icons.logo className="mx-auto size-24 lg:size-32 rounded-[2rem]" />
            </div>
            <div className="z-10 mt-4 flex flex-col items-center text-center text-black dark:text-white">
              <h1 className="text-3xl font-bold lg:text-4xl">
                Stop guessing where your money goes.
              </h1>
              <p className="mt-2">
                Upload your statement and get instant AI-powered insights.
              </p>
              <a
                href="#"
                className={cn(
                  buttonVariants({
                    size: "lg",
                    variant: "outline",
                  }),
                  "group mt-4 rounded-[2rem] px-6"
                )}
              >
                Get Started
                <ChevronRight className="ml-1 size-4 transition-all duration-300 ease-out group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
