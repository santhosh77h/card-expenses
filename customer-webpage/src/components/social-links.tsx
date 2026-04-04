"use client";

import { Icons } from "@/components/icons";
import { siteConfig } from "@/lib/config";
import { trackSocialClick } from "@/lib/analytics";

export function SocialLinks() {
  return (
    <div className="flex gap-x-3">
      <a
        href={siteConfig.links.instagram}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackSocialClick("instagram")}
        className="flex h-5 w-5 items-center justify-center text-muted-foreground transition-all duration-100 ease-linear hover:text-foreground"
      >
        <Icons.instagram className="fill-current" />
      </a>
      <a
        href={siteConfig.links.twitter}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackSocialClick("twitter")}
        className="flex h-5 w-5 items-center justify-center text-muted-foreground transition-all duration-100 ease-linear hover:text-foreground"
      >
        <Icons.twitter className="fill-current" />
      </a>
      <a
        href={siteConfig.links.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackSocialClick("linkedin")}
        className="flex h-5 w-5 items-center justify-center text-muted-foreground transition-all duration-100 ease-linear hover:text-foreground"
      >
        <Icons.linkedin className="fill-current" />
      </a>
    </div>
  );
}
