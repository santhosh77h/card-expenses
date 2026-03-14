"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Lock,
  Tag,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { uploadStatement } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") {
      setFile(dropped);
      setError("");
    } else {
      setError("Only PDF files are accepted.");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);

    try {
      const res = await uploadStatement(
        file,
        password || undefined,
        label || undefined
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Statement</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Upload a PDF credit card statement for parsing
        </p>
      </div>

      {/* Drop Zone */}
      <GlassCard
        className={`p-12 transition-all duration-200 ${
          dragOver ? "border-[#00E5A0] bg-[#00E5A0]/5" : ""
        }`}
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#00E5A0]/10 flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-[#00E5A0]" />
          </div>

          {file ? (
            <div className="text-center">
              <div className="flex items-center gap-2 text-white">
                <FileText className="w-4 h-4 text-[#00E5A0]" />
                <span className="font-medium">{file.name}</span>
                <span className="text-xs text-[#64748B]">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-xs text-[#64748B] hover:text-red-400 mt-2"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <p className="text-white font-medium">
                Drop your PDF here or{" "}
                <label className="text-[#00E5A0] cursor-pointer hover:underline">
                  browse
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </p>
              <p className="text-xs text-[#64748B] mt-2">
                PDF files up to 10MB
              </p>
            </>
          )}
        </div>
      </GlassCard>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassCard className="p-4">
          <label className="flex items-center gap-2 text-xs text-[#64748B] uppercase tracking-wider mb-2">
            <Lock className="w-3.5 h-3.5" /> Password (optional)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="For encrypted PDFs"
            className="w-full bg-[#0A0E1A] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#00E5A0]/50"
          />
        </GlassCard>

        <GlassCard className="p-4">
          <label className="flex items-center gap-2 text-xs text-[#64748B] uppercase tracking-wider mb-2">
            <Tag className="w-3.5 h-3.5" /> Label (optional)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., HDFC Credit Card"
            className="w-full bg-[#0A0E1A] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#00E5A0]/50"
          />
        </GlassCard>
      </div>

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full py-3 rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-[#00E5A0] text-[#0A0E1A] hover:bg-[#00E5A0]/90 flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Parsing Statement...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Upload & Parse
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <GlassCard className="p-4 border-red-500/30">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-400 font-medium">Error</p>
              <p className="text-sm text-[#94A3B8] mt-1">{error}</p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Success Result */}
      {result && (
        <GlassCard className="p-6 border-[#00E5A0]/30">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle className="w-5 h-5 text-[#00E5A0] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-[#00E5A0] font-medium">
                Statement Parsed Successfully
              </p>
              <p className="text-sm text-[#94A3B8] mt-1">
                {(result.summary as Record<string, unknown>)?.total_transactions as number || 0} transactions
                extracted from {result.bank_detected as string || "unknown"} statement
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <p className="text-xs text-[#64748B]">Transactions</p>
              <p className="text-lg font-bold text-white mt-1">
                {(result.summary as Record<string, unknown>)?.total_transactions as number || 0}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[#64748B]">Currency</p>
              <p className="text-lg font-bold text-white mt-1">
                {result.currency_detected as string || "—"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[#64748B]">Bank</p>
              <p className="text-lg font-bold text-white mt-1">
                {result.bank_detected as string || "—"}
              </p>
            </div>
          </div>

          {typeof result._statement_id === "string" && (
            <button
              onClick={() =>
                router.push(`/statements/${result._statement_id as string}`)
              }
              className="w-full mt-4 py-2 rounded-lg text-sm text-[#00E5A0] border border-[#00E5A0]/30 hover:bg-[#00E5A0]/10 transition-colors"
            >
              View Full Details →
            </button>
          )}
        </GlassCard>
      )}
    </div>
  );
}
