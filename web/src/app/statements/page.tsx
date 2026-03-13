"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Tag,
  X,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import {
  getStatements,
  deleteStatement,
  updateLabel,
  type StatementListItem,
  type StatementsResponse,
} from "@/lib/api";
import { formatDate, formatBytes, confidenceColor, confidenceBg } from "@/lib/utils";

export default function StatementsPage() {
  const router = useRouter();
  const [data, setData] = useState<StatementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStatements({ page, search, page_size: 15 });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this statement and all its data?")) return;
    await deleteStatement(id);
    load();
  };

  const handleLabelSave = async (id: string) => {
    await updateLabel(id, labelInput);
    setEditingLabel(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">All Statements</h1>
          <p className="text-sm text-[#64748B] mt-1">
            {data?.total || 0} statements parsed
          </p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch}>
        <GlassCard className="p-3 flex items-center gap-3">
          <Search className="w-4 h-4 text-[#64748B]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename or bank..."
            className="flex-1 bg-transparent text-sm text-white placeholder-[#64748B] focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="text-[#64748B] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </GlassCard>
      </form>

      {/* Table */}
      <GlassCard className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#00E5A0]/30 border-t-[#00E5A0] rounded-full animate-spin" />
          </div>
        ) : !data?.statements.length ? (
          <div className="p-12 text-center text-[#64748B]">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No statements found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[#64748B] uppercase tracking-wider border-b border-[#1E293B]">
                  <th className="text-left p-4 font-medium">Filename</th>
                  <th className="text-left p-4 font-medium">Bank</th>
                  <th className="text-left p-4 font-medium">Currency</th>
                  <th className="text-left p-4 font-medium">Txns</th>
                  <th className="text-left p-4 font-medium">Debits</th>
                  <th className="text-left p-4 font-medium">Confidence</th>
                  <th className="text-left p-4 font-medium">Method</th>
                  <th className="text-left p-4 font-medium">Label</th>
                  <th className="text-left p-4 font-medium">Date</th>
                  <th className="text-left p-4 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {data.statements.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/statements/${s.id}`)}
                    className="border-t border-[#1E293B]/50 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#64748B] shrink-0" />
                        <span className="text-sm text-white font-medium truncate max-w-[180px]">
                          {s.filename}
                        </span>
                      </div>
                      <span className="text-xs text-[#64748B] ml-6">
                        {formatBytes(s.file_size_bytes)}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-[#94A3B8]">
                      {s.bank_detected || "—"}
                    </td>
                    <td className="p-4 text-sm text-[#94A3B8]">
                      {s.currency_detected || "—"}
                    </td>
                    <td className="p-4 text-sm text-white font-mono">
                      {s.transaction_count}
                    </td>
                    <td className="p-4 text-sm text-white font-mono">
                      {s.total_debits?.toLocaleString("en-IN") || "—"}
                    </td>
                    <td className="p-4">
                      {s.confidence != null ? (
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded-full ${confidenceBg(s.confidence)}`}
                        >
                          {(s.confidence * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-xs text-[#64748B]">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">
                        {s.parsing_method || "—"}
                      </span>
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      {editingLabel === s.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={labelInput}
                            onChange={(e) => setLabelInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleLabelSave(s.id);
                              if (e.key === "Escape") setEditingLabel(null);
                            }}
                            className="w-28 bg-[#0A0E1A] border border-[#00E5A0]/50 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLabel(s.id);
                            setLabelInput(s.label || "");
                          }}
                          className="flex items-center gap-1 group"
                        >
                          {s.label ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/20">
                              {s.label}
                            </span>
                          ) : (
                            <span className="text-xs text-[#64748B] group-hover:text-[#00E5A0] flex items-center gap-1">
                              <Tag className="w-3 h-3" /> Add
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="p-4 text-xs text-[#64748B]">
                      {formatDate(s.created_at)}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={(e) => handleDelete(s.id, e)}
                        className="p-1.5 rounded-md text-[#64748B] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-[#1E293B]">
            <p className="text-xs text-[#64748B]">
              Page {data.page} of {data.total_pages}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-md text-[#64748B] hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= data.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-md text-[#64748B] hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
