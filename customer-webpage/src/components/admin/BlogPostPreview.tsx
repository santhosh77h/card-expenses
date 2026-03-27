"use client";

import BlogContent from "@/components/blog/BlogContent";
import { formatPublishedDate } from "@/lib/blog-utils";

interface PreviewData {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  readTime: number;
  faq: Array<{ question: string; answer: string }>;
}

export function BlogPostPreview({ data }: { data: PreviewData }) {
  const faqItems = data.faq.filter(
    (f) => f.question.trim() || f.answer.trim()
  );

  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden">
      {/* Preview banner */}
      <div className="bg-muted/50 border-b border-border px-4 py-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-medium text-muted-foreground">
          Live Preview
        </span>
      </div>

      {/* Rendered post */}
      <div className="p-6 sm:p-8 max-w-3xl">
        {/* Post header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            {data.category && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {data.category}
              </span>
            )}
            <span className="text-muted-foreground text-sm">
              {data.readTime} min read
            </span>
          </div>
          {data.title ? (
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight text-foreground">
              {data.title}
            </h1>
          ) : (
            <div className="h-10 bg-muted rounded w-2/3 mb-4" />
          )}
          {data.excerpt ? (
            <p className="text-muted-foreground text-lg mb-6">
              {data.excerpt}
            </p>
          ) : (
            <div className="h-5 bg-muted rounded w-1/2 mb-6" />
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground border-b border-border pb-6">
            <span>By {data.author || "Vector Team"}</span>
            <span>{formatPublishedDate(new Date().toISOString(), "long")}</span>
          </div>
        </div>

        {/* FAQ section */}
        {faqItems.length > 0 && (
          <div className="my-10 rounded-lg border border-border bg-card/50 p-6">
            <h2 className="text-lg font-semibold mb-4 text-foreground">
              Questions answered in this article
            </h2>
            <div className="space-y-3">
              {faqItems.map((item, i) => (
                <details key={i} className="group">
                  <summary className="cursor-pointer text-sm font-medium text-foreground hover:text-primary transition-colors list-none flex items-center justify-between">
                    {item.question || (
                      <span className="text-muted-foreground italic">
                        Empty question
                      </span>
                    )}
                    <svg
                      className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed pl-0">
                    {item.answer || (
                      <span className="italic">No answer provided</span>
                    )}
                  </p>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Post content */}
        {data.content ? (
          <BlogContent content={data.content} />
        ) : (
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
            <div className="h-4 bg-muted rounded w-4/6" />
          </div>
        )}
      </div>
    </div>
  );
}
