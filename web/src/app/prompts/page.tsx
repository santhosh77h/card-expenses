"use client";

import { useEffect, useState } from "react";
import {
  Terminal,
  Globe,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { getPrompts, type PromptsResponse } from "@/lib/api";

const SECTION_LABELS: Record<string, string> = {
  preamble: "Preamble",
  base_rules: "Base Rules",
  transaction_type_rules: "Transaction Type Rules",
  category_rules: "Category Rules",
  statement_period_rules: "Statement Period Rules",
  card_metadata_rules: "Card Metadata Rules",
  footer: "Footer",
};

const REGION_LABELS: Record<string, string> = {
  IN: "India",
  US: "United States",
  UK: "United Kingdom",
  AU: "Australia",
  CA: "Canada",
  EU: "Europe",
  APAC: "Asia Pacific",
};

export default function PromptEditorPage() {
  const [prompts, setPrompts] = useState<PromptsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRegion, setActiveRegion] = useState("IN");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["preamble"])
  );
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => {
    getPrompts()
      .then(setPrompts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const copySection = (section: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#00E5A0]/30 border-t-[#00E5A0] rounded-full animate-spin" />
      </div>
    );
  }

  if (!prompts) {
    return (
      <div className="text-center py-20 text-[#64748B]">
        Could not load prompts
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Prompt Editor</h1>
        <p className="text-sm text-[#64748B] mt-1">
          View the composable prompt templates used for LLM parsing
        </p>
      </div>

      {/* Region Selector */}
      <GlassCard className="p-4">
        <p className="text-xs text-[#64748B] uppercase tracking-wider mb-3">
          Region
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(REGION_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveRegion(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                activeRegion === key
                  ? "bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30"
                  : "text-[#64748B] border border-[#1E293B] hover:text-white hover:border-[#1E293B]"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Prompt Sections */}
      <div className="space-y-3">
        {Object.entries(prompts.sections).map(([key, content]) => (
          <GlassCard key={key} className="overflow-hidden">
            <button
              onClick={() => toggleSection(key)}
              className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                {expandedSections.has(key) ? (
                  <ChevronDown className="w-4 h-4 text-[#00E5A0]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#64748B]" />
                )}
                <Terminal className="w-4 h-4 text-[#64748B]" />
                <span className="text-sm font-medium text-white">
                  {SECTION_LABELS[key] || key}
                </span>
              </div>
              <span className="text-xs text-[#64748B]">
                {content.length} chars
              </span>
            </button>

            {expandedSections.has(key) && (
              <div className="px-4 pb-4">
                <div className="relative group">
                  <button
                    onClick={() => copySection(key, content)}
                    className="absolute top-3 right-3 p-1.5 rounded-md bg-[#1E293B] text-[#64748B] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    {copiedSection === key ? (
                      <Check className="w-3.5 h-3.5 text-[#00E5A0]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <pre className="text-xs text-[#94A3B8] bg-[#0A0E1A] rounded-lg p-4 overflow-auto max-h-[500px] whitespace-pre-wrap leading-relaxed">
                    {content}
                  </pre>
                </div>
              </div>
            )}
          </GlassCard>
        ))}

        {/* Region-specific rules */}
        <GlassCard className="overflow-hidden">
          <button
            onClick={() => toggleSection("region_rules")}
            className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSections.has("region_rules") ? (
                <ChevronDown className="w-4 h-4 text-[#00E5A0]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#64748B]" />
              )}
              <Globe className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">
                Region Rules — {REGION_LABELS[activeRegion] || activeRegion}
              </span>
            </div>
            <span className="text-xs text-[#64748B]">
              {(prompts.region_rules[activeRegion] || "").length} chars
            </span>
          </button>

          {expandedSections.has("region_rules") && (
            <div className="px-4 pb-4">
              <div className="relative group">
                <button
                  onClick={() =>
                    copySection(
                      "region_rules",
                      prompts.region_rules[activeRegion] || ""
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 rounded-md bg-[#1E293B] text-[#64748B] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  {copiedSection === "region_rules" ? (
                    <Check className="w-3.5 h-3.5 text-[#00E5A0]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <pre className="text-xs text-[#94A3B8] bg-[#0A0E1A] rounded-lg p-4 overflow-auto max-h-[500px] whitespace-pre-wrap leading-relaxed">
                  {prompts.region_rules[activeRegion] || "No rules for this region"}
                </pre>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Full Composed Prompt */}
      <GlassCard className="overflow-hidden">
        <button
          onClick={() => toggleSection("composed")}
          className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedSections.has("composed") ? (
              <ChevronDown className="w-4 h-4 text-[#00E5A0]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#64748B]" />
            )}
            <Terminal className="w-4 h-4 text-[#00E5A0]" />
            <span className="text-sm font-medium text-white">
              Full Composed Prompt — {REGION_LABELS[activeRegion]}
            </span>
          </div>
          <span className="text-xs text-[#64748B]">
            {(prompts.composed_prompts[activeRegion] || "").length} chars
          </span>
        </button>

        {expandedSections.has("composed") && (
          <div className="px-4 pb-4">
            <div className="relative group">
              <button
                onClick={() =>
                  copySection(
                    "composed",
                    prompts.composed_prompts[activeRegion] || ""
                  )
                }
                className="absolute top-3 right-3 p-1.5 rounded-md bg-[#1E293B] text-[#64748B] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                {copiedSection === "composed" ? (
                  <Check className="w-3.5 h-3.5 text-[#00E5A0]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <pre className="text-xs text-[#94A3B8] bg-[#0A0E1A] rounded-lg p-4 overflow-auto max-h-[600px] whitespace-pre-wrap leading-relaxed">
                {prompts.composed_prompts[activeRegion] || "No prompt available"}
              </pre>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
