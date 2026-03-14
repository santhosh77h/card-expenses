export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image: string;
  category: string;
  tags: string[];
  author: string;
  status: string;
  read_time: number;
  published_at: string;
  created_at: string;
  updated_at: string;
  faq?: Array<{ question: string; answer: string }>;
}

export interface BlogCategory {
  category: string;
  count: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const BLOG_API_KEY = process.env.NEXT_PUBLIC_BLOG_API_KEY || "";
const FETCH_TIMEOUT = 5000; // 5s timeout to avoid hanging during static builds

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
}

export async function getBlogPosts(
  limit = 10,
  offset = 0,
  category = ""
): Promise<{ posts: BlogPost[]; total: number }> {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (category) params.set("category", category);

    const res = await fetchWithTimeout(`${API_BASE}/api/blog/posts?${params}`, {
      next: { revalidate: 3600 },
    } as RequestInit);

    if (!res.ok) {
      return { posts: [], total: 0 };
    }

    return res.json();
  } catch {
    return { posts: [], total: 0 };
  }
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/blog/posts/${slug}`, {
      next: { revalidate: 3600 },
    } as RequestInit);

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Admin CRUD functions (no caching, throw on error)
// ---------------------------------------------------------------------------

export async function getAdminBlogPosts(
  limit = 50,
  offset = 0,
  status = ""
): Promise<{ posts: BlogPost[]; total: number }> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    status,
  });
  const res = await fetch(`${API_BASE}/api/blog/posts?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
  return res.json();
}

export async function createBlogPost(
  data: Record<string, unknown>
): Promise<BlogPost> {
  const res = await fetch(`${API_BASE}/api/blog/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Blog-API-Key": BLOG_API_KEY },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create post: ${res.status}`);
  return res.json();
}

export async function updateBlogPost(
  postId: string,
  data: Record<string, unknown>
): Promise<BlogPost> {
  const res = await fetch(`${API_BASE}/api/blog/posts/${postId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Blog-API-Key": BLOG_API_KEY },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update post: ${res.status}`);
  return res.json();
}

export async function deleteBlogPost(postId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/blog/posts/${postId}`, {
    method: "DELETE",
    headers: { "X-Blog-API-Key": BLOG_API_KEY },
  });
  if (!res.ok) throw new Error(`Failed to delete post: ${res.status}`);
}

// ---------------------------------------------------------------------------
// Public read functions
// ---------------------------------------------------------------------------

export async function getBlogCategories(): Promise<BlogCategory[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/blog/categories`, {
      next: { revalidate: 3600 },
    } as RequestInit);

    if (!res.ok) return [];
    const data = await res.json();
    return data.categories || [];
  } catch {
    return [];
  }
}
