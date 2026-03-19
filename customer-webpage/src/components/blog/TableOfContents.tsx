"use client";

import { useEffect, useRef, useState } from "react";
import type { TocHeading } from "@/lib/blog-utils";
import { cn } from "@/lib/utils";

export default function TableOfContents({
  headings,
}: {
  headings: TocHeading[];
}) {
  const [activeId, setActiveId] = useState<string>("");
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [width, setWidth] = useState<number>(256);

  // Measure the placeholder to get the fixed left/width
  useEffect(() => {
    const measure = () => {
      if (!placeholderRef.current) return;
      const rect = placeholderRef.current.getBoundingClientRect();
      setLeft(rect.left);
      setWidth(rect.width);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Track active heading via IntersectionObserver
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <>
      {/* Invisible placeholder - keeps the aside width in the layout */}
      <div ref={placeholderRef} className="w-full" aria-hidden />

      {/* Fixed TOC pinned to the viewport */}
      {left !== null && (
        <div
          className="fixed top-24 max-h-[calc(100vh-8rem)] overflow-y-auto z-40"
          style={{ left, width }}
        >
          <p className="text-sm font-semibold text-foreground mb-4">
            On this page
          </p>
          <ul className="space-y-2.5 text-sm border-l border-border">
            {headings.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById(heading.id);
                    if (el) {
                      const top = el.getBoundingClientRect().top + window.scrollY - 100;
                      window.scrollTo({ top, behavior: "smooth" });
                      setActiveId(heading.id);
                    }
                  }}
                  className={cn(
                    "block transition-colors duration-150 -ml-px border-l-2",
                    heading.level === 3 ? "pl-7" : "pl-4",
                    activeId === heading.id
                      ? "border-primary text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                  )}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
