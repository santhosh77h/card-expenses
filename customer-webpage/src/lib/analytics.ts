// Google Analytics 4 event tracking utility
// Measurement ID: G-R1K3YW8Q6G (loaded in [locale]/layout.tsx)

type GtagEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
};

function trackEvent({ action, category, label, value }: GtagEvent) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value,
  });
}

// ── App Store / Download ──────────────────────────────────────────
export function trackAppStoreClick(location: "hero" | "header" | "mobile_drawer" | "cta" | "try_demo_modal") {
  trackEvent({
    action: "app_store_click",
    category: "conversion",
    label: location,
  });
}

// ── CTA buttons ───────────────────────────────────────────────────
export function trackTryDemoClick() {
  trackEvent({
    action: "try_demo_click",
    category: "engagement",
    label: "hero",
  });
}

export function trackCtaClick(location: "bottom_cta" | "pricing") {
  trackEvent({
    action: "cta_click",
    category: "conversion",
    label: location,
  });
}

// ── Pricing ───────────────────────────────────────────────────────
export function trackPricingPlanClick(plan: "monthly" | "yearly") {
  trackEvent({
    action: "pricing_plan_click",
    category: "conversion",
    label: plan,
  });
}

// ── FAQ ───────────────────────────────────────────────────────────
export function trackFaqOpen(questionKey: string) {
  trackEvent({
    action: "faq_open",
    category: "engagement",
    label: questionKey,
  });
}

// ── Social links ──────────────────────────────────────────────────
export function trackSocialClick(platform: "instagram" | "twitter" | "linkedin") {
  trackEvent({
    action: "social_click",
    category: "engagement",
    label: platform,
  });
}

// ── Contact ──────────────────────────────────────────────────────
export function trackContactFormSubmit(subject: string) {
  trackEvent({
    action: "contact_form_submit",
    category: "engagement",
    label: subject,
  });
}

// ── Blog ──────────────────────────────────────────────────────────
export function trackBlogCategoryFilter(category: string) {
  trackEvent({
    action: "blog_category_filter",
    category: "engagement",
    label: category || "all",
  });
}

export function trackBlogPostClick(slug: string) {
  trackEvent({
    action: "blog_post_click",
    category: "engagement",
    label: slug,
  });
}
