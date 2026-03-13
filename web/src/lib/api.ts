const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// --- Stats ---

export interface DashboardStats {
  total_statements: number;
  total_transactions: number;
  avg_confidence: number;
  total_debits_all: number;
  total_credits_all: number;
  banks: { bank: string; count: number }[];
  recent: {
    id: string;
    filename: string;
    bank_detected: string;
    created_at: string;
    transaction_count: number;
    confidence: number;
    label: string;
  }[];
}

export function getStats(): Promise<DashboardStats> {
  return fetchApi("/api/dashboard/stats");
}

// --- Statements ---

export interface StatementListItem {
  id: string;
  filename: string;
  file_size_bytes: number;
  bank_detected: string;
  currency_detected: string;
  transaction_count: number;
  total_debits: number;
  total_credits: number;
  net: number;
  confidence: number;
  consensus_method: string;
  parsing_method: string;
  label: string;
  notes: string;
  statement_period_from: string;
  statement_period_to: string;
  card_last4: string;
  card_network: string;
  created_at: string;
}

export interface StatementsResponse {
  statements: StatementListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export function getStatements(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  bank?: string;
  label?: string;
}): Promise<StatementsResponse> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.page_size) sp.set("page_size", String(params.page_size));
  if (params?.search) sp.set("search", params.search);
  if (params?.bank) sp.set("bank", params.bank);
  if (params?.label) sp.set("label", params.label);
  return fetchApi(`/api/dashboard/statements?${sp}`);
}

export interface LLMCall {
  id: string;
  stage: string;
  provider: string;
  provider_model: string;
  system_prompt: string;
  user_message: string;
  raw_response: string;
  parsed_response: Record<string, unknown> | null;
  success: number;
  error: string | null;
  latency_ms: number;
  created_at: string;
}

export interface StatementDetail extends StatementListItem {
  llm_calls: LLMCall[];
  full_response: Record<string, unknown> | null;
  country_detected: string;
  region_detected: string;
  date_format_detected: string;
  statement_type_detected: string;
  language_detected: string;
  llm_count: number;
  llm_sources: string;
  transactions_flagged: number;
  pdf_password: string | null;
}

export function getStatement(id: string): Promise<StatementDetail> {
  return fetchApi(`/api/dashboard/statements/${id}`);
}

export function updateLabel(
  id: string,
  label: string,
  notes: string = ""
): Promise<{ status: string }> {
  return fetchApi(`/api/dashboard/statements/${id}/label`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, notes }),
  });
}

export function deleteStatement(
  id: string
): Promise<{ status: string }> {
  return fetchApi(`/api/dashboard/statements/${id}`, { method: "DELETE" });
}

// --- Upload ---

export async function uploadStatement(
  file: File,
  password?: string,
  label?: string
): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append("file", file);
  if (password) form.append("password", password);
  if (label) form.append("label", label);
  return fetchApi("/api/dashboard/upload", { method: "POST", body: form });
}

// --- PDF ---

export function getPdfUrl(statementId: string): string {
  return `${API_BASE}/api/dashboard/statements/${statementId}/pdf`;
}

// --- Labels ---

export function getLabels(): Promise<{ labels: string[] }> {
  return fetchApi("/api/dashboard/labels");
}

// --- Prompts ---

export interface PromptsResponse {
  sections: Record<string, string>;
  region_rules: Record<string, string>;
  composed_prompts: Record<string, string>;
}

export function getPrompts(): Promise<PromptsResponse> {
  return fetchApi("/api/dashboard/prompts");
}
