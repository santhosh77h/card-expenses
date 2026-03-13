"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Activity,
  TrendingUp,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { getStats, type DashboardStats } from "@/lib/api";
import { formatDate, confidenceColor } from "@/lib/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#00E5A0]/30 border-t-[#00E5A0] rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-20 text-[#64748B]">
        <p>Could not connect to API. Make sure the backend is running.</p>
        <p className="text-sm mt-2 font-mono">
          uvicorn app:app --reload --host 0.0.0.0 --port 8000
        </p>
      </div>
    );
  }

  const statCards = [
    {
      label: "Statements Parsed",
      value: stats.total_statements,
      icon: FileText,
      color: "text-[#00E5A0]",
      bg: "bg-[#00E5A0]/10",
    },
    {
      label: "Transactions Extracted",
      value: stats.total_transactions,
      icon: Activity,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "Avg Confidence",
      value: `${(stats.avg_confidence * 100).toFixed(1)}%`,
      icon: TrendingUp,
      color: confidenceColor(stats.avg_confidence),
      bg: stats.avg_confidence >= 0.8 ? "bg-green-400/10" : "bg-yellow-400/10",
    },
    {
      label: "Total Volume",
      value: `₹${stats.total_debits_all.toLocaleString("en-IN")}`,
      icon: Zap,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Statement parsing observability
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <GlassCard key={card.label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#64748B] uppercase tracking-wider">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-white mt-2">
                  {card.value}
                </p>
              </div>
              <div className={`p-2.5 rounded-lg ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Banks Distribution */}
      {stats.banks.length > 0 && (
        <GlassCard className="p-6">
          <h2 className="text-sm font-medium text-white mb-4">
            Banks Processed
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.banks.map((b) => (
              <span
                key={b.bank}
                className="px-3 py-1.5 rounded-full text-xs bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/20"
              >
                {b.bank} ({b.count})
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Recent Uploads */}
      <GlassCard className="overflow-hidden">
        <div className="p-6 border-b border-[#1E293B]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">Recent Uploads</h2>
            <button
              onClick={() => router.push("/statements")}
              className="text-xs text-[#00E5A0] hover:underline flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {stats.recent.length === 0 ? (
          <div className="p-12 text-center text-[#64748B]">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No statements parsed yet</p>
            <button
              onClick={() => router.push("/upload")}
              className="mt-3 text-sm text-[#00E5A0] hover:underline"
            >
              Upload your first statement
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[#64748B] uppercase tracking-wider">
                  <th className="text-left p-4 font-medium">Filename</th>
                  <th className="text-left p-4 font-medium">Bank</th>
                  <th className="text-left p-4 font-medium">Transactions</th>
                  <th className="text-left p-4 font-medium">Confidence</th>
                  <th className="text-left p-4 font-medium">Label</th>
                  <th className="text-left p-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/statements/${r.id}`)}
                    className="border-t border-[#1E293B] hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="p-4 text-sm text-white font-medium truncate max-w-[200px]">
                      {r.filename}
                    </td>
                    <td className="p-4 text-sm text-[#94A3B8]">
                      {r.bank_detected || "—"}
                    </td>
                    <td className="p-4 text-sm text-[#94A3B8]">
                      {r.transaction_count}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-sm font-mono ${confidenceColor(r.confidence || 0)}`}
                      >
                        {r.confidence
                          ? `${(r.confidence * 100).toFixed(0)}%`
                          : "—"}
                      </span>
                    </td>
                    <td className="p-4">
                      {r.label ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/20">
                          {r.label}
                        </span>
                      ) : (
                        <span className="text-xs text-[#64748B]">—</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-[#64748B]">
                      {formatDate(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
