"use client";

import { useState, useEffect } from "react";
import type { BlogPost } from "@/lib/blog-api";
import { slugify } from "@/lib/blog-utils";
import { Button } from "@/components/ui/button";

interface BlogPostFormProps {
  initialData?: BlogPost;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

const CATEGORY_SUGGESTIONS = [
  "Privacy",
  "Engineering",
  "Guide",
  "Finance",
  "Product",
  "Security",
  "General",
];

export function BlogPostForm({ initialData, onSubmit }: BlogPostFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initialData?.excerpt ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "General");
  const [tags, setTags] = useState(initialData?.tags?.join(", ") ?? "");
  const [author, setAuthor] = useState(initialData?.author ?? "Vector Team");
  const [coverImage, setCoverImage] = useState(initialData?.cover_image ?? "");
  const [readTime, setReadTime] = useState(initialData?.read_time ?? 5);
  const [faqItems, setFaqItems] = useState<Array<{ question: string; answer: string }>>(
    initialData?.faq ?? []
  );
  const [submitting, setSubmitting] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!initialData);

  useEffect(() => {
    if (autoSlug) {
      setSlug(slugify(title));
    }
  }, [title, autoSlug]);

  async function handleSubmit(status: string) {
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        slug,
        excerpt,
        content,
        category,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        faq: faqItems.filter((f) => f.question.trim() || f.answer.trim()),
        author,
        cover_image: coverImage,
        read_time: readTime,
        status,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title"
          className={inputClass}
        />
      </div>

      {/* Slug */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Slug</label>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setAutoSlug(false);
              setSlug(e.target.value);
            }}
            placeholder="post-slug"
            className={inputClass}
          />
          {!autoSlug && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAutoSlug(true);
                setSlug(slugify(title));
              }}
            >
              Auto
            </Button>
          )}
        </div>
      </div>

      {/* Excerpt */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Excerpt</label>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="Short description"
          rows={2}
          className={inputClass}
        />
      </div>

      {/* Content */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Content (Markdown)
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your post in Markdown..."
          rows={16}
          className={`${inputClass} font-mono`}
        />
      </div>

      {/* Two-column row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="category-suggestions"
            className={inputClass}
          />
          <datalist id="category-suggestions">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="privacy, security, guide"
            className={inputClass}
          />
        </div>
      </div>

      {/* Three-column row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Author */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Author</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Cover Image */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Cover Image URL
          </label>
          <input
            type="text"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </div>

        {/* Read Time */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Read Time (min)
          </label>
          <input
            type="number"
            value={readTime}
            onChange={(e) => setReadTime(Number(e.target.value))}
            min={1}
            className={inputClass}
          />
        </div>
      </div>

      {/* FAQ Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium">FAQ Items</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFaqItems([...faqItems, { question: "", answer: "" }])}
          >
            Add Question
          </Button>
        </div>
        {faqItems.length === 0 && (
          <p className="text-sm text-muted-foreground">No FAQ items yet. Add questions to improve SEO.</p>
        )}
        <div className="space-y-4">
          {faqItems.map((item, index) => (
            <div key={index} className="border border-border rounded-md p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1 text-muted-foreground">
                    Question {index + 1}
                  </label>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => {
                      const updated = [...faqItems];
                      updated[index] = { ...updated[index], question: e.target.value };
                      setFaqItems(updated);
                    }}
                    placeholder="e.g. How does Vector protect my data?"
                    className={inputClass}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-5 text-destructive hover:text-destructive"
                  onClick={() => setFaqItems(faqItems.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Answer</label>
                <textarea
                  value={item.answer}
                  onChange={(e) => {
                    const updated = [...faqItems];
                    updated[index] = { ...updated[index], answer: e.target.value };
                    setFaqItems(updated);
                  }}
                  placeholder="Provide a clear, concise answer..."
                  rows={3}
                  className={inputClass}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-border">
        <Button
          onClick={() => handleSubmit("draft")}
          variant="outline"
          disabled={submitting || !title || !slug}
        >
          {submitting ? "Saving..." : "Save as Draft"}
        </Button>
        <Button
          onClick={() => handleSubmit("published")}
          disabled={submitting || !title || !slug}
        >
          {submitting ? "Publishing..." : "Publish"}
        </Button>
      </div>
    </div>
  );
}
