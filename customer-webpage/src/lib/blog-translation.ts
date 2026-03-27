import OpenAI from "openai";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { BlogPost } from "./blog-api";

const CACHE_DIR = path.join(process.cwd(), ".blog-cache");
const MODEL = "anthropic/claude-sonnet-4";
const TRANSLATABLE_FIELDS: (keyof BlogPost)[] = [
  "title",
  "excerpt",
  "content",
];

interface TranslatedBlogPost extends BlogPost {
  locale: string;
  originalSlug: string;
}

const LOCALE_NAMES: Record<string, string> = {
  hi: "Hindi",
  es: "Spanish",
  fr: "French",
  de: "German",
};

function getCacheKey(slug: string, locale: string, contentHash: string): string {
  return `${slug}_${locale}_${contentHash}`;
}

function getContentHash(post: BlogPost): string {
  const hashInput = TRANSLATABLE_FIELDS.map((f) => post[f] ?? "").join("|");
  return crypto.createHash("md5").update(hashInput).digest("hex").slice(0, 12);
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readCache(cacheKey: string): TranslatedBlogPost | null {
  const filePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, data: TranslatedBlogPost): void {
  ensureCacheDir();
  const filePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function translateFields(
  post: BlogPost,
  locale: string
): Promise<Pick<BlogPost, "title" | "excerpt" | "content"> & { faq?: BlogPost["faq"] }> {
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const fieldsToTranslate: Record<string, string> = {};
  for (const field of TRANSLATABLE_FIELDS) {
    if (post[field]) fieldsToTranslate[field] = post[field] as string;
  }

  let faqPrompt = "";
  if (post.faq && post.faq.length > 0) {
    faqPrompt = `\n\nAlso translate this FAQ array (keep the JSON structure, translate "question" and "answer" values only):\n${JSON.stringify(post.faq, null, 2)}`;
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: `You are a professional translator for "Vector Expense", a personal finance app.
Translate the following blog post fields from English to ${LOCALE_NAMES[locale]}.

Rules:
- Preserve ALL HTML tags and markdown formatting exactly
- Do NOT translate: "Vector", "Vector Expense", "App Store", "Google Play", URLs, email addresses, code blocks
- Use standard financial terminology in the target language
- For Hindi: use formal register
- Return ONLY valid JSON with the translated fields — no explanation, no markdown fences

Fields to translate:
${JSON.stringify(fieldsToTranslate, null, 2)}${faqPrompt}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content || "";
  const clean = text
    .replace(/^```json\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  return JSON.parse(clean);
}

/**
 * Translate a blog post to a target locale.
 * Uses filesystem-based caching keyed on slug + locale + content hash.
 * Returns the original post unchanged if locale is "en" or translation fails.
 */
export async function getTranslatedBlogPost(
  post: BlogPost,
  locale: string
): Promise<TranslatedBlogPost> {
  if (locale === "en") {
    return { ...post, locale: "en", originalSlug: post.slug };
  }

  const contentHash = getContentHash(post);
  const cacheKey = getCacheKey(post.slug, locale, contentHash);

  const cached = readCache(cacheKey);
  if (cached) return cached;

  try {
    const translated = await translateFields(post, locale);

    const result: TranslatedBlogPost = {
      ...post,
      title: translated.title || post.title,
      excerpt: translated.excerpt || post.excerpt,
      content: translated.content || post.content,
      faq: translated.faq || post.faq,
      locale,
      originalSlug: post.slug,
    };

    writeCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error(
      `Failed to translate blog post "${post.slug}" to ${locale}:`,
      error
    );
    return { ...post, locale, originalSlug: post.slug };
  }
}

/**
 * Translate multiple blog posts to a target locale.
 * Translates sequentially to avoid rate limiting.
 */
export async function getTranslatedBlogPosts(
  posts: BlogPost[],
  locale: string
): Promise<TranslatedBlogPost[]> {
  const results: TranslatedBlogPost[] = [];
  for (const post of posts) {
    results.push(await getTranslatedBlogPost(post, locale));
  }
  return results;
}

/**
 * Clear the blog translation cache.
 * Optionally filter by slug or locale.
 */
export function clearBlogTranslationCache(options?: {
  slug?: string;
  locale?: string;
}): number {
  ensureCacheDir();
  const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
  let deleted = 0;

  for (const file of files) {
    const name = file.replace(".json", "");
    const shouldDelete =
      !options ||
      (!options.slug && !options.locale) ||
      (options.slug && name.startsWith(`${options.slug}_`)) ||
      (options.locale && name.includes(`_${options.locale}_`));

    if (shouldDelete) {
      fs.unlinkSync(path.join(CACHE_DIR, file));
      deleted++;
    }
  }

  return deleted;
}
