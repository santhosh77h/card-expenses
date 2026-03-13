"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Brain,
  Code2,
  Send,
  Shield,
  Tag,
  Clock,
  CheckCircle,
  XCircle,
  Columns2,
  Maximize2,
  Minimize2,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { JsonViewer } from "@/components/JsonViewer";
import {
  getStatement,
  updateLabel,
  getPdfUrl,
  type StatementDetail,
} from "@/lib/api";
import {
  formatDate,
  formatBytes,
  confidenceColor,
  confidenceBg,
} from "@/lib/utils";

type TabId =
  | "pdf-response"
  | "transactions"
  | "prompts"
  | "llm-responses"
  | "final-response"
  | "consensus";

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "pdf-response", label: "PDF & Response", icon: Columns2 },
  { id: "transactions", label: "Transactions", icon: FileText },
  { id: "prompts", label: "Prompt Used", icon: Brain },
  { id: "llm-responses", label: "LLM Raw Responses", icon: Code2 },
  { id: "final-response", label: "Final Response", icon: Send },
  { id: "consensus", label: "Consensus Details", icon: Shield },
];

export default function StatementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [stmt, setStmt] = useState<StatementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("pdf-response");
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState("");

  useEffect(() => {
    const id = params.id as string;
    getStatement(id)
      .then((data) => {
        setStmt(data);
        setLabelInput(data.label || "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleLabelSave = async () => {
    if (!stmt) return;
    await updateLabel(stmt.id, labelInput);
    setStmt({ ...stmt, label: labelInput });
    setEditingLabel(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#00E5A0]/30 border-t-[#00E5A0] rounded-full animate-spin" />
      </div>
    );
  }

  if (!stmt) {
    return (
      <div className="text-center py-20 text-[#64748B]">
        Statement not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push("/statements")}
          className="p-2 rounded-lg text-[#64748B] hover:text-white hover:bg-white/5 mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">
            {stmt.filename}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-[#64748B]">
            <span>{formatBytes(stmt.file_size_bytes)}</span>
            <span>{formatDate(stmt.created_at)}</span>
            {stmt.bank_detected && <span>{stmt.bank_detected}</span>}
            {stmt.currency_detected && <span>{stmt.currency_detected}</span>}
          </div>
        </div>

        {/* Label */}
        <div className="shrink-0">
          {editingLabel ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLabelSave();
                  if (e.key === "Escape") setEditingLabel(false);
                }}
                placeholder="e.g., HDFC Credit Card"
                className="bg-[#0A0E1A] border border-[#00E5A0]/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none w-48"
                autoFocus
              />
              <button
                onClick={handleLabelSave}
                className="px-3 py-1.5 rounded-lg bg-[#00E5A0] text-[#0A0E1A] text-xs font-medium"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingLabel(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#1E293B] hover:border-[#00E5A0]/30 text-sm transition-colors"
            >
              <Tag className="w-3.5 h-3.5 text-[#64748B]" />
              {stmt.label ? (
                <span className="text-[#00E5A0]">{stmt.label}</span>
              ) : (
                <span className="text-[#64748B]">Add Label</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Transactions", value: stmt.transaction_count },
          {
            label: "Total Debits",
            value: `₹${stmt.total_debits?.toLocaleString("en-IN") || 0}`,
          },
          {
            label: "Total Credits",
            value: `₹${stmt.total_credits?.toLocaleString("en-IN") || 0}`,
          },
          {
            label: "Confidence",
            value: stmt.confidence
              ? `${(stmt.confidence * 100).toFixed(0)}%`
              : "—",
            className: stmt.confidence
              ? confidenceColor(stmt.confidence)
              : "",
          },
          { label: "Method", value: stmt.parsing_method || "—" },
          {
            label: "Card",
            value: stmt.card_last4 ? `•••• ${stmt.card_last4}` : "—",
          },
        ].map((item) => (
          <GlassCard key={item.label} className="p-3">
            <p className="text-[10px] text-[#64748B] uppercase tracking-wider">
              {item.label}
            </p>
            <p
              className={`text-sm font-bold mt-1 ${item.className || "text-white"}`}
            >
              {item.value}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1E293B] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-[#00E5A0] text-[#00E5A0]"
                : "border-transparent text-[#64748B] hover:text-white"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "pdf-response" && (
          <PdfResponseTab statementId={stmt.id} response={stmt.full_response} pdfPassword={stmt.pdf_password} />
        )}
        {activeTab === "transactions" && (
          <TransactionsTab response={stmt.full_response} />
        )}
        {activeTab === "prompts" && <PromptsTab calls={stmt.llm_calls} />}
        {activeTab === "llm-responses" && (
          <LLMResponsesTab calls={stmt.llm_calls} />
        )}
        {activeTab === "final-response" && (
          <FinalResponseTab response={stmt.full_response} />
        )}
        {activeTab === "consensus" && (
          <ConsensusTab response={stmt.full_response} stmt={stmt} />
        )}
      </div>
    </div>
  );
}

// --- Tab Components ---

function PdfResponseTab({
  statementId,
  response,
  pdfPassword,
}: {
  statementId: string;
  response: Record<string, unknown> | null;
  pdfPassword: string | null;
}) {
  const [pdfExpanded, setPdfExpanded] = useState(false);
  const [rightPanel, setRightPanel] = useState<
    "transactions" | "summary" | "card_info" | "full"
  >("transactions");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const pdfUrl = getPdfUrl(statementId);

  const handleCopyPassword = () => {
    if (pdfPassword) {
      navigator.clipboard.writeText(pdfPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const transactions =
    (response?.transactions as Array<Record<string, unknown>>) || [];
  const summary = response?.summary as Record<string, unknown> | null;
  const cardInfo = response?.card_info as Record<string, unknown> | null;

  return (
    <div className="space-y-3">
      {/* Right panel selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(
            [
              { id: "transactions", label: "Transactions" },
              { id: "summary", label: "Summary" },
              { id: "card_info", label: "Card Info" },
              { id: "full", label: "Full JSON" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setRightPanel(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                rightPanel === opt.id
                  ? "bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30"
                  : "text-[#64748B] border border-[#1E293B] hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setPdfExpanded(!pdfExpanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#64748B] border border-[#1E293B] hover:text-white transition-colors"
        >
          {pdfExpanded ? (
            <Minimize2 className="w-3 h-3" />
          ) : (
            <Maximize2 className="w-3 h-3" />
          )}
          {pdfExpanded ? "Split View" : "Expand PDF"}
        </button>
      </div>

      {/* Side-by-side */}
      <div
        className={`grid gap-4 ${pdfExpanded ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}
      >
        {/* PDF Viewer */}
        <GlassCard className="overflow-hidden">
          <div className="p-3 border-b border-[#1E293B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#00E5A0]" />
              <span className="text-xs font-medium text-white">
                Original PDF
              </span>
            </div>
            {pdfPassword && (
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-yellow-400" />
                <span className="text-[10px] text-yellow-400 uppercase tracking-wider font-medium">
                  Password:
                </span>
                <code className="text-xs font-mono bg-[#0A0E1A] border border-[#1E293B] rounded px-2 py-0.5 text-white min-w-[60px]">
                  {showPassword ? pdfPassword : "\u2022".repeat(Math.min(pdfPassword.length, 12))}
                </code>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 rounded hover:bg-white/5 text-[#64748B] hover:text-white transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-3 h-3" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={handleCopyPassword}
                  className="p-1 rounded hover:bg-white/5 text-[#64748B] hover:text-white transition-colors"
                  title="Copy password"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-[#00E5A0]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            )}
          </div>
          <div
            className={pdfExpanded ? "h-[85vh]" : "h-[75vh]"}
          >
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=0`}
              className="w-full h-full border-0"
              title="Statement PDF"
            />
          </div>
        </GlassCard>

        {/* Response Panel */}
        {!pdfExpanded && (
          <div className="h-[75vh] overflow-y-auto space-y-3">
            {rightPanel === "transactions" && (
              <GlassCard className="overflow-hidden">
                <div className="p-3 border-b border-[#1E293B] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-medium text-white">
                      Parsed Transactions
                    </span>
                  </div>
                  <span className="text-xs text-[#64748B]">
                    {transactions.length} found
                  </span>
                </div>
                <div className="divide-y divide-[#1E293B]/50">
                  {transactions.map((tx, i) => (
                    <div
                      key={i}
                      className="p-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#64748B] font-mono">
                              #{i + 1}
                            </span>
                            <span className="text-xs text-[#94A3B8] font-mono">
                              {tx.date as string}
                            </span>
                          </div>
                          <p className="text-sm text-white mt-0.5 truncate">
                            {tx.description as string}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: `${tx.category_color as string}20`,
                                color: tx.category_color as string,
                              }}
                            >
                              {tx.category as string}
                            </span>
                            <span className="text-[10px] text-[#64748B]">
                              {tx.transaction_type as string}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-sm font-mono font-medium shrink-0 ${
                            tx.type === "credit"
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {tx.type === "credit" ? "+" : "-"}₹
                          {(tx.amount as number)?.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="p-8 text-center text-[#64748B] text-sm">
                      No transactions
                    </div>
                  )}
                </div>
              </GlassCard>
            )}

            {rightPanel === "summary" && (
              <GlassCard className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium text-white">
                    Summary
                  </span>
                </div>
                <JsonViewer data={summary} maxHeight="65vh" />
              </GlassCard>
            )}

            {rightPanel === "card_info" && (
              <GlassCard className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium text-white">
                    Card Info
                  </span>
                </div>
                {cardInfo ? (
                  <JsonViewer data={cardInfo} maxHeight="65vh" />
                ) : (
                  <p className="text-sm text-[#64748B]">
                    No card info extracted
                  </p>
                )}
              </GlassCard>
            )}

            {rightPanel === "full" && (
              <GlassCard className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Code2 className="w-4 h-4 text-[#00E5A0]" />
                  <span className="text-xs font-medium text-white">
                    Full Response
                  </span>
                </div>
                <JsonViewer data={response} maxHeight="65vh" />
              </GlassCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionsTab({
  response,
}: {
  response: Record<string, unknown> | null;
}) {
  const transactions =
    (response?.transactions as Array<Record<string, unknown>>) || [];

  if (!transactions.length) {
    return (
      <div className="text-center py-12 text-[#64748B]">
        No transactions found
      </div>
    );
  }

  return (
    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-[#64748B] uppercase tracking-wider border-b border-[#1E293B]">
              <th className="text-left p-3 font-medium">#</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Category</th>
              <th className="text-left p-3 font-medium">Txn Type</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => (
              <tr
                key={i}
                className="border-t border-[#1E293B]/50 hover:bg-white/[0.02]"
              >
                <td className="p-3 text-xs text-[#64748B] font-mono">
                  {i + 1}
                </td>
                <td className="p-3 text-sm text-[#94A3B8] font-mono whitespace-nowrap">
                  {tx.date as string}
                </td>
                <td className="p-3 text-sm text-white max-w-[300px] truncate">
                  {tx.description as string}
                </td>
                <td className="p-3 text-sm font-mono text-right whitespace-nowrap">
                  <span
                    className={
                      tx.type === "credit"
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {tx.type === "credit" ? "+" : "-"}₹
                    {(tx.amount as number)?.toLocaleString("en-IN")}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      tx.type === "credit"
                        ? "bg-green-400/10 text-green-400"
                        : "bg-red-400/10 text-red-400"
                    }`}
                  >
                    {tx.type as string}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${tx.category_color as string}20`,
                      color: tx.category_color as string,
                    }}
                  >
                    {tx.category as string}
                  </span>
                </td>
                <td className="p-3 text-xs text-[#94A3B8]">
                  {tx.transaction_type as string}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

function PromptsTab({
  calls,
}: {
  calls: StatementDetail["llm_calls"];
}) {
  if (!calls?.length) {
    return (
      <div className="text-center py-12 text-[#64748B]">
        No LLM calls recorded
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {calls.map((call) => (
        <GlassCard key={call.id} className="overflow-hidden">
          <div className="p-4 border-b border-[#1E293B] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-4 h-4 text-[#00E5A0]" />
              <span className="text-sm font-medium text-white">
                {call.provider_model}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">
                {call.stage}
              </span>
              {call.success ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <Clock className="w-3 h-3" />
              {call.latency_ms ? `${call.latency_ms}ms` : "—"}
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs text-[#64748B] uppercase tracking-wider mb-2">
                System Prompt
              </p>
              <pre className="text-xs text-[#94A3B8] bg-[#0A0E1A] rounded-lg p-4 overflow-auto max-h-[400px] whitespace-pre-wrap">
                {call.system_prompt}
              </pre>
            </div>

            <div>
              <p className="text-xs text-[#64748B] uppercase tracking-wider mb-2">
                User Message
              </p>
              <pre className="text-xs text-[#94A3B8] bg-[#0A0E1A] rounded-lg p-4 overflow-auto max-h-[300px] whitespace-pre-wrap">
                {call.user_message}
              </pre>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function LLMResponsesTab({
  calls,
}: {
  calls: StatementDetail["llm_calls"];
}) {
  if (!calls?.length) {
    return (
      <div className="text-center py-12 text-[#64748B]">
        No LLM calls recorded
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {calls.map((call) => (
        <GlassCard key={call.id} className="overflow-hidden">
          <div className="p-4 border-b border-[#1E293B] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Code2 className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white">
                {call.provider_model}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">
                {call.stage}
              </span>
              {call.success ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <Clock className="w-3 h-3" />
              {call.latency_ms ? `${call.latency_ms}ms` : "—"}
            </div>
          </div>

          <div className="p-4">
            {call.error ? (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <XCircle className="w-4 h-4" />
                {call.error}
              </div>
            ) : call.raw_response ? (
              <div>
                <p className="text-xs text-[#64748B] uppercase tracking-wider mb-2">
                  Raw Response
                </p>
                <JsonViewer
                  data={(() => {
                    try {
                      return JSON.parse(call.raw_response);
                    } catch {
                      return call.raw_response;
                    }
                  })()}
                />
              </div>
            ) : call.parsed_response ? (
              <div>
                <p className="text-xs text-[#64748B] uppercase tracking-wider mb-2">
                  Parsed Response
                </p>
                <JsonViewer data={call.parsed_response} />
              </div>
            ) : (
              <p className="text-sm text-[#64748B]">No response data</p>
            )}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function FinalResponseTab({
  response,
}: {
  response: Record<string, unknown> | null;
}) {
  if (!response) {
    return (
      <div className="text-center py-12 text-[#64748B]">
        No response data stored
      </div>
    );
  }

  return (
    <GlassCard className="p-4">
      <p className="text-xs text-[#64748B] uppercase tracking-wider mb-3">
        Full API Response
      </p>
      <JsonViewer data={response} maxHeight="700px" />
    </GlassCard>
  );
}

function ConsensusTab({
  response,
  stmt,
}: {
  response: Record<string, unknown> | null;
  stmt: StatementDetail;
}) {
  const validation = response?.validation as Record<string, unknown> | null;

  if (!validation) {
    return (
      <div className="text-center py-12 text-[#64748B]">
        <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>No consensus validation data</p>
        <p className="text-xs mt-1">
          Consensus requires 2+ LLM providers configured
        </p>
      </div>
    );
  }

  const perTxConf =
    (validation.per_transaction_confidence as number[]) || [];
  const sources = (() => {
    try {
      if (typeof stmt.llm_sources === "string") {
        return JSON.parse(stmt.llm_sources) as string[];
      }
      return [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassCard className="p-4">
          <p className="text-[10px] text-[#64748B] uppercase tracking-wider">
            Overall Confidence
          </p>
          <p
            className={`text-2xl font-bold mt-1 ${confidenceColor((validation.confidence as number) || 0)}`}
          >
            {(((validation.confidence as number) || 0) * 100).toFixed(1)}%
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[10px] text-[#64748B] uppercase tracking-wider">
            LLM Providers
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {(validation.llm_count as number) || 0}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[10px] text-[#64748B] uppercase tracking-wider">
            Method
          </p>
          <p className="text-sm font-bold text-white mt-2">
            {(validation.consensus_method as string) || "—"}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[10px] text-[#64748B] uppercase tracking-wider">
            Flagged
          </p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">
            {(validation.transactions_flagged as number) || 0}
          </p>
        </GlassCard>
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <GlassCard className="p-4">
          <p className="text-xs text-[#64748B] uppercase tracking-wider mb-3">
            LLM Sources
          </p>
          <div className="flex flex-wrap gap-2">
            {sources.map((s: string, i: number) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full text-xs bg-purple-400/10 text-purple-400 border border-purple-400/20"
              >
                {s}
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Per-transaction confidence */}
      {perTxConf.length > 0 && (
        <GlassCard className="p-4">
          <p className="text-xs text-[#64748B] uppercase tracking-wider mb-3">
            Per-Transaction Confidence
          </p>
          <div className="flex flex-wrap gap-1.5">
            {perTxConf.map((conf, i) => (
              <span
                key={i}
                className={`text-[10px] font-mono px-2 py-1 rounded ${confidenceBg(conf)}`}
              >
                #{i + 1}: {(conf * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Full validation data */}
      <GlassCard className="p-4">
        <p className="text-xs text-[#64748B] uppercase tracking-wider mb-3">
          Raw Validation Data
        </p>
        <JsonViewer data={validation} />
      </GlassCard>
    </div>
  );
}
