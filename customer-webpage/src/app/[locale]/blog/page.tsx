import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getBlogPosts, getBlogCategories } from "@/lib/blog-api";
import { siteConfig } from "@/lib/config";
import BlogCard from "@/components/blog/BlogCard";
import FeaturedBlogCard from "@/components/blog/FeaturedBlogCard";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: `${siteConfig.url}/blog` },
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      type: "website",
      url: `${siteConfig.url}/blog`,
      siteName: siteConfig.name,
    },
  };
}

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");

  const resolvedSearchParams = await searchParams;
  const category = resolvedSearchParams.category || "";

  const [{ posts }, categories] = await Promise.all([
    getBlogPosts(20, 0, category),
    getBlogCategories(),
  ]);

  const featuredPost = !category && posts.length > 0 ? posts[0] : null;
  const gridPosts = featuredPost ? posts.slice(1) : posts;

  return (
    <>
      {/* Hero */}
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-16 pb-12 text-center">
          <span className="inline-block text-xs font-medium uppercase tracking-widest text-primary mb-4">
            {t("title")}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            {t("pageTitle")}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("pageSubtitle")}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12">
        {/* Category filters */}
        {categories.length > 0 && (
          <div className="flex justify-center gap-2 mb-10 flex-wrap">
            <Link
              href="/blog"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !category
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {t("all")}
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.category}
                href={`/blog?category=${encodeURIComponent(cat.category)}`}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  category === cat.category
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {cat.category} ({cat.count})
              </Link>
            ))}
          </div>
        )}

        {/* Featured post */}
        {featuredPost && <FeaturedBlogCard post={featuredPost} />}

        {/* Posts grid */}
        {gridPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gridPosts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        ) : !featuredPost ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">
              {t("noPosts")}
            </p>
            <Link
              href="/"
              className="inline-block mt-4 text-primary hover:underline"
            >
              {t("backToHome")}
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}
