import type { BlogPost } from "@/lib/blog-api";

interface FaqItem {
  question: string;
  answer: string;
}

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function extractHeadings(content: string): TocHeading[] {
  const headings: TocHeading[] = [];
  for (const line of content.split("\n")) {
    if (line.startsWith("### ")) {
      headings.push({ id: slugify(line.slice(4)), text: line.slice(4), level: 3 });
    } else if (line.startsWith("## ")) {
      headings.push({ id: slugify(line.slice(3)), text: line.slice(3), level: 2 });
    } else if (line.startsWith("# ")) {
      headings.push({ id: slugify(line.slice(2)), text: line.slice(2), level: 1 });
    }
  }
  return headings;
}

export function formatPublishedDate(
  dateString: string,
  style: "short" | "long" = "short"
): string {
  if (!dateString) return "";
  const options: Intl.DateTimeFormatOptions =
    style === "long"
      ? { month: "long", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return new Date(dateString).toLocaleDateString("en-US", options);
}

export function getPostFaq(post: BlogPost): FaqItem[] {
  return post.faq?.slice(0, 5) ?? [];
}
