"use client";

import { useEffect, useState } from "react";
import type { BlogPostVersion } from "@/lib/blog-api";
import { getBlogPostVersions, restoreBlogPostVersion } from "@/lib/blog-api";
import { formatPublishedDate } from "@/lib/blog-utils";
import { Button } from "@/components/ui/button";
import BlogContent from "@/components/blog/BlogContent";

interface VersionHistoryProps {
  postId: string;
  currentContent: string;
  onRestored: () => void;
}

export function VersionHistory({
  postId,
  currentContent,
  onRestored,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<BlogPostVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] =
    useState<BlogPostVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [showDiff, setShowDiff] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const v = await getBlogPostVersions(postId);
      setVersions(v);
      setLoading(false);
    }
    load();
  }, [postId]);

  async function handleRestore(versionId: string) {
    if (!confirm("Restore this version? The current version will be saved to history."))
      return;
    setRestoring(true);
    try {
      await restoreBlogPostVersion(postId, versionId);
      onRestored();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to restore");
    } finally {
      setRestoring(false);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Loading version history...
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card/50 p-6 text-center">
        <div className="text-muted-foreground text-sm mb-1">
          No previous versions yet
        </div>
        <div className="text-muted-foreground/60 text-xs">
          Versions are saved automatically every time you update a post.
          Up to 3 versions are kept.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Version list */}
      <div className="space-y-2">
        {versions.map((v, idx) => {
          const isSelected = selectedVersion?.id === v.id;
          const contentChanged = v.content !== currentContent;
          const titleChanged =
            selectedVersion && v.title !== selectedVersion.title;

          return (
            <div key={v.id}>
              <button
                type="button"
                onClick={() =>
                  setSelectedVersion(isSelected ? null : v)
                }
                className={`w-full text-left rounded-lg border p-4 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {v.title}
                      </span>
                      {contentChanged && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600">
                          Changed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {formatPublishedDate(v.saved_at, "long")}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">
                        {v.status}
                      </span>
                      <span>{v.category}</span>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${
                      isSelected ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Expanded version detail */}
              {isSelected && (
                <div className="mt-2 rounded-lg border border-border bg-background overflow-hidden">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                    <div className="inline-flex items-center gap-1 bg-muted rounded-md p-0.5">
                      <button
                        type="button"
                        onClick={() => setShowDiff(true)}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                          showDiff
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDiff(false)}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                          !showDiff
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Full Preview
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleRestore(v.id)}
                      disabled={restoring}
                    >
                      {restoring ? "Restoring..." : "Restore this version"}
                    </Button>
                  </div>

                  {/* Content area */}
                  <div className="p-4 max-h-[500px] overflow-y-auto">
                    {showDiff ? (
                      <DiffView
                        oldContent={v.content}
                        newContent={currentContent}
                        oldTitle={v.title}
                      />
                    ) : (
                      <div className="max-w-3xl">
                        <h2 className="text-xl font-bold mb-2 text-foreground">
                          {v.title}
                        </h2>
                        <p className="text-sm text-muted-foreground mb-4">
                          {v.excerpt}
                        </p>
                        <BlogContent content={v.content} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple line-based diff view
// ---------------------------------------------------------------------------

function DiffView({
  oldContent,
  newContent,
  oldTitle,
}: {
  oldContent: string;
  newContent: string;
  oldTitle: string;
}) {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  // Simple line-level diff: find added, removed, and unchanged lines
  const maxLen = Math.max(oldLines.length, newLines.length);
  const diffLines: Array<{
    type: "same" | "removed" | "added";
    text: string;
  }> = [];

  // Use a basic LCS-inspired approach for small content
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  let oi = 0;
  let ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length) {
      if (oldLines[oi] === newLines[ni]) {
        diffLines.push({ type: "same", text: oldLines[oi] });
        oi++;
        ni++;
      } else if (!newSet.has(oldLines[oi])) {
        diffLines.push({ type: "removed", text: oldLines[oi] });
        oi++;
      } else if (!oldSet.has(newLines[ni])) {
        diffLines.push({ type: "added", text: newLines[ni] });
        ni++;
      } else {
        // Both lines exist elsewhere — treat as replacement
        diffLines.push({ type: "removed", text: oldLines[oi] });
        diffLines.push({ type: "added", text: newLines[ni] });
        oi++;
        ni++;
      }
    } else if (oi < oldLines.length) {
      diffLines.push({ type: "removed", text: oldLines[oi] });
      oi++;
    } else {
      diffLines.push({ type: "added", text: newLines[ni] });
      ni++;
    }
  }

  const hasChanges = diffLines.some((l) => l.type !== "same");

  if (!hasChanges) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        No content changes between this version and the current post.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
          Removed (version)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30" />
          Added (current)
        </span>
      </div>
      <div className="font-mono text-xs rounded-md border border-border overflow-hidden">
        {diffLines.map((line, i) => (
          <div
            key={i}
            className={`px-3 py-0.5 border-b border-border/50 last:border-0 ${
              line.type === "removed"
                ? "bg-red-500/10 text-red-400"
                : line.type === "added"
                  ? "bg-green-500/10 text-green-400"
                  : "text-muted-foreground"
            }`}
          >
            <span className="select-none mr-2 opacity-50">
              {line.type === "removed" ? "-" : line.type === "added" ? "+" : " "}
            </span>
            {line.text || "\u00A0"}
          </div>
        ))}
      </div>
    </div>
  );
}
