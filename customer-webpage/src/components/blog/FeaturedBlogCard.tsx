import { Link } from "@/i18n/navigation";
import type { BlogPost } from "@/lib/blog-api";
import { formatPublishedDate } from "@/lib/blog-utils";

export default function FeaturedBlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block mb-10">
      <article className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-primary/30 flex flex-col md:flex-row">
        {/* Image */}
        <div className="relative md:w-[60%] aspect-video md:aspect-auto md:min-h-[300px] bg-gradient-to-br from-primary/10 via-muted to-muted/50 overflow-hidden">
          {post.cover_image ? (
            <img
              src={post.cover_image}
              alt={post.title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-7xl font-bold text-primary/10">V</span>
            </div>
          )}
          <div className="absolute top-4 left-4">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-background/80 backdrop-blur-sm text-foreground">
              Featured
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="md:w-[40%] p-6 sm:p-8 flex flex-col justify-center">
          <span className="text-xs font-medium text-primary mb-3 uppercase tracking-wider">
            {post.category}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 group-hover:text-primary transition-colors leading-tight">
            {post.title}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base mb-5 line-clamp-3">
            {post.excerpt}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{post.author}</span>
            <span>·</span>
            <span>{post.read_time} min read</span>
            {post.published_at && (
              <>
                <span>·</span>
                <span>{formatPublishedDate(post.published_at)}</span>
              </>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
