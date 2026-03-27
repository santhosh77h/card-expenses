import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config";
import { getBlogPosts } from "@/lib/blog-api";
import { locales, defaultLocale } from "@/i18n/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;

  const staticPaths = ["", "/blog", "/privacy", "/terms"];
  const staticPages: MetadataRoute.Sitemap = locales.flatMap((locale) => {
    const prefix = locale === defaultLocale ? "" : `/${locale}`;
    return staticPaths.map((path) => ({
      url: `${baseUrl}${prefix}${path}`,
      lastModified: new Date(),
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path === "/blog" ? 0.8 : 0.3,
    }));
  });

  const { posts } = await getBlogPosts(1000, 0);
  const blogPages: MetadataRoute.Sitemap = locales.flatMap((locale) => {
    const prefix = locale === defaultLocale ? "" : `/${locale}`;
    return posts.map((post) => ({
      url: `${baseUrl}${prefix}/blog/${post.slug}`,
      lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  });

  return [...staticPages, ...blogPages];
}
