"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { BlogPost } from "@/lib/blog-api";
import { getBlogPost, updateBlogPost } from "@/lib/blog-api";
import { BlogPostForm } from "@/components/admin/BlogPostForm";

export default function EditBlogPostPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
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
    load();
  }, [params.slug]);

  async function handleSubmit(data: Record<string, unknown>) {
    if (!post) return;
    await updateBlogPost(post.id, data);
    router.push("/admin/blog");
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
      <h2 className="text-2xl font-bold mb-6">Edit Post</h2>
      <BlogPostForm initialData={post} onSubmit={handleSubmit} />
    </div>
  );
}
