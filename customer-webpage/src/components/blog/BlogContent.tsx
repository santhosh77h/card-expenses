"use client";

import React from "react";
import { slugify } from "@/lib/blog-utils";

function processInlineFormatting(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /`([^`]+)`/g,
      '<code class="text-primary bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>'
    );
}

interface LineNode {
  type:
    | "h1"
    | "h2"
    | "h3"
    | "ul-item"
    | "ol-item"
    | "blockquote"
    | "hr"
    | "blank"
    | "table-row"
    | "table-separator"
    | "p";
  content: string;
  raw: string;
}

function parseLine(line: string): LineNode {
  if (line.startsWith("# "))
    return { type: "h1", content: line.slice(2), raw: line };
  if (line.startsWith("## "))
    return { type: "h2", content: line.slice(3), raw: line };
  if (line.startsWith("### "))
    return { type: "h3", content: line.slice(4), raw: line };
  if (line.startsWith("- "))
    return { type: "ul-item", content: line.slice(2), raw: line };
  if (/^\d+\.\s/.test(line))
    return { type: "ol-item", content: line.replace(/^\d+\.\s/, ""), raw: line };
  if (line.startsWith("> "))
    return { type: "blockquote", content: line.slice(2), raw: line };
  if (line.trim() === "---" || line.trim() === "***")
    return { type: "hr", content: "", raw: line };
  if (line.trim() === "")
    return { type: "blank", content: "", raw: line };
  // Table rows: lines starting and ending with |, or starting with |
  if (/^\|(.+\|)\s*$/.test(line.trim())) {
    // Check if it's a separator row like |---|---|
    if (/^\|[\s:]*-{2,}[\s:]*\|/.test(line.trim()))
      return { type: "table-separator", content: line, raw: line };
    return { type: "table-row", content: line, raw: line };
  }
  return { type: "p", content: line, raw: line };
}

export default function BlogContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes = lines.map(parseLine);
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < nodes.length) {
    const node = nodes[i];

    // Group consecutive list items
    if (node.type === "ul-item") {
      const items: string[] = [];
      while (i < nodes.length && nodes[i].type === "ul-item") {
        items.push(nodes[i].content);
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc ml-6 my-4 space-y-1">
          {items.map((item, j) => (
            <li
              key={j}
              className="text-muted-foreground"
              dangerouslySetInnerHTML={{
                __html: processInlineFormatting(item),
              }}
            />
          ))}
        </ul>
      );
      continue;
    }

    if (node.type === "ol-item") {
      const items: string[] = [];
      while (i < nodes.length && nodes[i].type === "ol-item") {
        items.push(nodes[i].content);
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal ml-6 my-4 space-y-1">
          {items.map((item, j) => (
            <li
              key={j}
              className="text-muted-foreground"
              dangerouslySetInnerHTML={{
                __html: processInlineFormatting(item),
              }}
            />
          ))}
        </ol>
      );
      continue;
    }

    // Group consecutive table rows
    if (node.type === "table-row" || node.type === "table-separator") {
      const tableLines: LineNode[] = [];
      while (
        i < nodes.length &&
        (nodes[i].type === "table-row" || nodes[i].type === "table-separator")
      ) {
        tableLines.push(nodes[i]);
        i++;
      }

      // Parse cells from a table row string
      const parseCells = (line: string) =>
        line
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());

      // First non-separator row is the header
      const headerLine = tableLines.find((l) => l.type === "table-row");
      const headerCells = headerLine ? parseCells(headerLine.content) : [];

      // Body rows are all table-row lines after the separator
      const sepIndex = tableLines.findIndex(
        (l) => l.type === "table-separator"
      );
      const bodyLines = tableLines.filter(
        (l, idx) => l.type === "table-row" && idx > sepIndex
      );

      elements.push(
        <div key={`table-${i}`} className="my-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            {headerCells.length > 0 && (
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {headerCells.map((cell, j) => (
                    <th
                      key={j}
                      className="px-4 py-3 text-left font-semibold text-foreground"
                      dangerouslySetInnerHTML={{
                        __html: processInlineFormatting(cell),
                      }}
                    />
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyLines.map((row, rowIdx) => {
                const cells = parseCells(row.content);
                return (
                  <tr
                    key={rowIdx}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {cells.map((cell, j) => (
                      <td
                        key={j}
                        className="px-4 py-3 text-muted-foreground"
                        dangerouslySetInnerHTML={{
                          __html: processInlineFormatting(cell),
                        }}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Individual elements
    switch (node.type) {
      case "h1":
        elements.push(
          <h1
            key={i}
            id={slugify(node.content)}
            className="text-3xl font-bold mt-8 mb-4 scroll-mt-28"
          >
            {node.content}
          </h1>
        );
        break;
      case "h2":
        elements.push(
          <h2
            key={i}
            id={slugify(node.content)}
            className="text-2xl font-semibold mt-8 mb-3 scroll-mt-28"
          >
            {node.content}
          </h2>
        );
        break;
      case "h3":
        elements.push(
          <h3
            key={i}
            id={slugify(node.content)}
            className="text-xl font-semibold mt-6 mb-2 scroll-mt-28"
          >
            {node.content}
          </h3>
        );
        break;
      case "blockquote":
        elements.push(
          <blockquote
            key={i}
            className="border-l-2 border-primary pl-4 italic text-muted-foreground my-4"
            dangerouslySetInnerHTML={{
              __html: processInlineFormatting(node.content),
            }}
          />
        );
        break;
      case "hr":
        elements.push(
          <hr key={i} className="my-8 border-border" />
        );
        break;
      case "blank":
        elements.push(<br key={i} />);
        break;
      case "p":
        elements.push(
          <p
            key={i}
            className="text-muted-foreground leading-relaxed mb-4"
            dangerouslySetInnerHTML={{
              __html: processInlineFormatting(node.content),
            }}
          />
        );
        break;
    }
    i++;
  }

  return (
    <div className="prose prose-neutral max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-li:text-muted-foreground prose-blockquote:border-primary prose-blockquote:text-muted-foreground">
      {elements}
    </div>
  );
}
