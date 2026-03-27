import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface BreadcrumbProps {
  postTitle: string;
}

export default function Breadcrumb({ postTitle }: BreadcrumbProps) {
  const t = useTranslations("blog");
  const truncated =
    postTitle.length > 40 ? postTitle.slice(0, 40) + "\u2026" : postTitle;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6"
    >
      <Link
        href="/"
        className="hover:text-foreground transition-colors"
      >
        {t("breadcrumbHome")}
      </Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <Link
        href="/blog"
        className="hover:text-foreground transition-colors"
      >
        {t("breadcrumbBlog")}
      </Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className="text-foreground/70 truncate max-w-[200px] sm:max-w-none">
        {truncated}
      </span>
    </nav>
  );
}
