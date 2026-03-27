"use client";

import { useState, useEffect } from "react";
import type { BlogPost } from "@/lib/blog-api";
import { slugify } from "@/lib/blog-utils";
import { Button } from "@/components/ui/button";
import { BlogPostPreview } from "./BlogPostPreview";

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

type ViewMode = "editor" | "preview" | "split";

/** Convert an ISO string to a local datetime-local input value */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

/** Convert a datetime-local input value to an ISO string (UTC) */
function fromDatetimeLocal(val: string): string {
  return new Date(val).toISOString();
}

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
  const [viewMode, setViewMode] = useState<ViewMode>("editor");

  // Scheduling state
  const [showSchedule, setShowSchedule] = useState(!!initialData?.scheduled_at);
  const [scheduledAt, setScheduledAt] = useState(
    initialData?.scheduled_at ? toDatetimeLocal(initialData.scheduled_at) : ""
  );

  useEffect(() => {
    if (autoSlug) {
      setSlug(slugify(title));
    }
  }, [title, autoSlug]);

  async function handleSubmit(status: string, schedule?: boolean) {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
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
      };

      if (schedule && scheduledAt) {
        payload.scheduled_at = fromDatetimeLocal(scheduledAt);
        payload.status = "scheduled";
      } else {
        payload.scheduled_at = null;
      }

      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  const previewData = {
    title,
    excerpt,
    content,
    category,
    author,
    readTime,
    faq: faqItems,
  };

  const viewModeButton = (mode: ViewMode, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setViewMode(mode)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        viewMode === mode
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  // Minimum datetime for scheduling (now + 5 minutes)
  const minScheduleDate = (() => {
    const d = new Date(Date.now() + 5 * 60000);
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
  })();

  const isScheduleValid = showSchedule && scheduledAt && scheduledAt >= minScheduleDate;

  const scheduleLabel = scheduledAt
    ? new Date(scheduledAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
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
        {submitting ? "Publishing..." : "Publish Now"}
      </Button>

      {/* Schedule toggle */}
      <div className="ml-auto flex items-center gap-2">
        {showSchedule && (
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={minScheduleDate}
              className={`${inputClass} w-auto text-xs`}
            />
            <Button
              onClick={() => handleSubmit("scheduled", true)}
              disabled={submitting || !title || !slug || !isScheduleValid}
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10"
            >
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              {submitting ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setShowSchedule(!showSchedule);
            if (showSchedule) setScheduledAt("");
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
            showSchedule
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v9.75" />
          </svg>
          {showSchedule ? "Cancel schedule" : "Schedule"}
        </button>
      </div>
    </div>
  );

  // Show current schedule info banner if post is already scheduled
  const scheduleBanner = initialData?.status === "scheduled" && initialData?.scheduled_at && (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/5 mb-6">
      <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <div className="text-sm">
        <span className="font-medium text-amber-600">Scheduled to publish </span>
        <span className="text-foreground">
          {new Date(initialData.scheduled_at).toLocaleString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );

  const editorPanel = (
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
          rows={viewMode === "split" ? 24 : 16}
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
      {actionButtons}
    </div>
  );

  return (
    <div>
      {/* Schedule banner */}
      {scheduleBanner}

      {/* View mode toggle bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="inline-flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {viewModeButton(
            "editor",
            "Editor",
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          )}
          {viewModeButton(
            "split",
            "Split",
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.5 19.5h15a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5h-15A1.5 1.5 0 0 0 3 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
            </svg>
          )}
          {viewModeButton(
            "preview",
            "Preview",
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          )}
        </div>

        {viewMode !== "editor" && (
          <span className="text-xs text-muted-foreground">
            Preview updates as you type
          </span>
        )}
      </div>

      {/* Layout based on view mode */}
      {viewMode === "editor" && editorPanel}

      {viewMode === "preview" && (
        <div>
          <BlogPostPreview data={previewData} />
          {/* Floating action bar in preview mode */}
          <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t border-border mt-6 -mx-2 px-2 py-3 flex gap-3">
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
              {submitting ? "Publishing..." : "Publish Now"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setViewMode("editor")}
              className="ml-auto"
            >
              Back to Editor
            </Button>
          </div>
        </div>
      )}

      {viewMode === "split" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="min-w-0">{editorPanel}</div>
          <div className="min-w-0 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
            <BlogPostPreview data={previewData} />
          </div>
        </div>
      )}
    </div>
  );
}
