"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BlogPost } from "@/lib/blog-api";
import {
  getAdminBlogPosts,
  deleteBlogPost,
  updateBlogPost,
} from "@/lib/blog-api";
import { formatPublishedDate } from "@/lib/blog-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function loadPosts() {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminBlogPosts(50, 0);
      setPosts(data.posts);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  async function handleDelete(postId: string) {
    try {
      await deleteBlogPost(postId);
      setConfirmDeleteId(null);
      await loadPosts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete post");
    }
  }

  async function handleToggleStatus(post: BlogPost) {
    const newStatus = post.status === "published" ? "draft" : "published";
    try {
      await updateBlogPost(post.id, { status: newStatus });
      await loadPosts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update post");
    }
  }

  const publishedCount = posts.filter((p) => p.status === "published").length;
  const draftCount = posts.filter((p) => p.status === "draft").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading posts...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Blog Posts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your blog content
          </p>
        </div>
        <Link href="/admin/blog/new">
          <Button>New Post</Button>
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: total },
          { label: "Published", value: publishedCount },
          { label: "Drafts", value: draftCount },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card p-4 text-center"
          >
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-4">No blog posts yet</p>
          <Link href="/admin/blog/new">
            <Button>Create your first post</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Title</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-left px-4 py-3 font-medium">Author</th>
                  <th className="text-left px-4 py-3 font-medium">Updated</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr
                    key={post.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Title + Slug */}
                    <td className="px-4 py-3">
                      <div className="font-medium">{post.title}</div>
                      <div className="text-xs text-muted-foreground">
                        /{post.slug}
                      </div>
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          post.status === "published"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-amber-500/15 text-amber-500"
                        )}
                      >
                        {post.status}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {post.category}
                    </td>

                    {/* Author */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {post.author}
                    </td>

                    {/* Updated */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatPublishedDate(post.updated_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/blog/edit/${post.slug}`}>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(post)}
                        >
                          {post.status === "published"
                            ? "Unpublish"
                            : "Publish"}
                        </Button>
                        {confirmDeleteId === post.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(post.id)}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setConfirmDeleteId(post.id)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
