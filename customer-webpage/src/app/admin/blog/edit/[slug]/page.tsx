"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { BlogPost } from "@/lib/blog-api";
import { getBlogPost, updateBlogPost } from "@/lib/blog-api";
import { BlogPostForm } from "@/components/admin/BlogPostForm";
import { VersionHistory } from "@/components/admin/VersionHistory";

export default function EditBlogPostPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showVersions, setShowVersions] = useState(false);

  async function loadPost() {
    try {
      const data = await getBlogPost(params.slug);
      if (!data) {
        setError("Post not found");
        return;
      }
      setPost(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load post");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPost();
  }, [params.slug]);

  async function handleSubmit(data: Record<string, unknown>) {
    if (!post) return;
    await updateBlogPost(post.id, data);
    router.push("/admin/blog");
  }

  function handleRestored() {
    // Reload post after restoring a version
    setLoading(true);
    loadPost();
    setShowVersions(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading post...
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive mb-4">{error || "Post not found"}</p>
        <button
          onClick={() => router.push("/admin/blog")}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Edit Post</h2>
        <button
          type="button"
          onClick={() => setShowVersions(!showVersions)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
            showVersions
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          Version History
        </button>
      </div>

      {showVersions && (
        <div className="mb-8">
          <VersionHistory
            postId={post.id}
            currentContent={post.content}
            onRestored={handleRestored}
          />
        </div>
      )}

      <BlogPostForm initialData={post} onSubmit={handleSubmit} />
    </div>
  );
}
