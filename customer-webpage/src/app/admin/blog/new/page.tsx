"use client";

import { useRouter } from "next/navigation";
import { createBlogPost } from "@/lib/blog-api";
import { BlogPostForm } from "@/components/admin/BlogPostForm";

export default function NewBlogPostPage() {
  const router = useRouter();

  async function handleSubmit(data: Record<string, unknown>) {
    await createBlogPost(data);
    router.push("/admin/blog");
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">New Post</h2>
      <BlogPostForm onSubmit={handleSubmit} />
    </div>
  );
}
