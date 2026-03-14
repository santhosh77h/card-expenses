"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface JsonViewerProps {
  data: unknown;
  maxHeight?: string;
}

export function JsonViewer({ data, maxHeight = "500px" }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 rounded-md bg-[#1E293B] text-[#64748B] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-[#00E5A0]" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <pre
        className="json-viewer overflow-auto rounded-lg bg-[#0A0E1A] p-4 text-sm"
        style={{ maxHeight }}
      >
        <Highlighted text={text} />
      </pre>
    </div>
  );
}

function Highlighted({ text }: { text: string }) {
  // Simple JSON syntax highlighting
  const highlighted = text.replace(
    /("(?:\\.|[^"\\])*")\s*:/g,
    '<span class="json-key">$1</span>:'
  ).replace(
    /:\s*("(?:\\.|[^"\\])*")/g,
    ': <span class="json-string">$1</span>'
  ).replace(
    /:\s*(\d+\.?\d*)/g,
    ': <span class="json-number">$1</span>'
  ).replace(
    /:\s*(true|false)/g,
    ': <span class="json-boolean">$1</span>'
  ).replace(
    /:\s*(null)/g,
    ': <span class="json-null">$1</span>'
  );

  return <code dangerouslySetInnerHTML={{ __html: highlighted }} />;
}
