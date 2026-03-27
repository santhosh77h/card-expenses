import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlogPost, getBlogPosts } from "@/lib/blog-api";
import { getPostFaq, formatPublishedDate, extractHeadings } from "@/lib/blog-utils";
import { siteConfig } from "@/lib/config";
import BlogContent from "@/components/blog/BlogContent";
import BlogCard from "@/components/blog/BlogCard";
import BlogFaq from "@/components/blog/BlogFaq";
import Breadcrumb from "@/components/blog/Breadcrumb";
import TableOfContents from "@/components/blog/TableOfContents";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await getBlogPost(slug);
  if (!post) return { title: "Post Not Found - Vector Expense" };

  const url = `${siteConfig.url}/blog/${post.slug}`;
  const images = post.cover_image ? [post.cover_image] : [];

  return {
    title: `${post.title} - Vector Expense Blog`,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url,
      siteName: siteConfig.name,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      authors: [post.author],
      tags: post.tags,
      ...(images.length > 0 && { images }),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      ...(images.length > 0 && { images }),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");

  const post = await getBlogPost(slug);
  if (!post) notFound();

  const faq = getPostFaq(post);
  const headings = extractHeadings(post.content);
  const url = `${siteConfig.url}/blog/${post.slug}`;

  const { posts: relatedPosts } = await getBlogPosts(4, 0, post.category);
  const filtered = relatedPosts
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);

  return (
    <>
      {/* BlogPosting structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt,
            author: { "@type": "Person", name: post.author },
            datePublished: post.published_at,
            dateModified: post.updated_at,
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            publisher: { "@type": "Organization", name: "Vector Expense" },
            ...(post.cover_image && { image: post.cover_image }),
            ...(post.tags?.length && { keywords: post.tags.join(", ") }),
          }),
        }}
      />

      {/* BreadcrumbList structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: siteConfig.url,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Blog",
                item: `${siteConfig.url}/blog`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: post.title,
                item: url,
              },
            ],
          }),
        }}
      />

      {/* FAQPage structured data - only for authored FAQ */}
      {faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faq.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.answer,
                },
              })),
            }),
          }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
        <div className="max-w-3xl">
          <Breadcrumb postTitle={post.title} />
        </div>

        {/* Two-column layout: content + TOC sidebar */}
        <div className="flex gap-10">
          {/* Main content */}
          <article className="max-w-3xl min-w-0 flex-1">
            {/* Post header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {post.category}
                </span>
                <span className="text-muted-foreground text-sm">
                  {t("minRead", { time: post.read_time })}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
                {post.title}
              </h1>
              <p className="text-muted-foreground text-lg mb-6">
                {post.excerpt}
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground border-b border-border pb-6">
                <span>{t("by", { author: post.author })}</span>
                {post.published_at && (
                  <span>
                    {formatPublishedDate(post.published_at, "long")}
                  </span>
                )}
              </div>
            </div>

            {/* FAQ section */}
            <BlogFaq faq={faq} />

            {/* Post content */}
            <BlogContent content={post.content} />
          </article>

          {/* Sticky TOC sidebar */}
          <aside className="hidden xl:block w-64 shrink-0">
            <TableOfContents headings={headings} />
          </aside>
        </div>

        {/* Related posts - full width below */}
        {filtered.length > 0 && (
          <div className="mt-16 pt-10 border-t border-border max-w-3xl">
            <h3 className="text-xl font-semibold mb-6">{t("relatedPosts")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((related) => (
                <BlogCard key={related.id} post={related} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
