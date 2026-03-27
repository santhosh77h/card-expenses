import { Link } from "@/i18n/navigation";
import type { BlogPost } from "@/lib/blog-api";
import { formatPublishedDate } from "@/lib/blog-utils";

export default function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className="rounded-lg border border-border bg-card overflow-hidden transition-all hover:shadow-md hover:border-primary/30 h-full flex flex-col">
        {/* Cover image */}
        <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-muted to-muted/50">
          {post.cover_image ? (
            <img
              src={post.cover_image}
              alt={post.title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-bold text-muted-foreground/20">
                V
              </span>
            </div>
          )}
        </div>

        <div className="p-5 flex-1 flex flex-col">
          <span className="text-xs font-medium text-primary mb-2 uppercase tracking-wider">
            {post.category}
          </span>
          <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {post.title}
          </h3>
          <p className="text-muted-foreground text-sm mb-4 flex-1 line-clamp-3">
            {post.excerpt}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{post.author}</span>
            <div className="flex items-center gap-3">
              <span>{post.read_time} min read</span>
              {post.published_at && (
                <span>{formatPublishedDate(post.published_at)}</span>
              )}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
