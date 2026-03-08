/**
 * On-device NLU engine for Vector expense app.
 *
 * Loads two TFLite models (intent classifier + entity extractor) and converts
 * natural language queries into structured SQL queries against the transactions table.
 *
 * Pipeline:  User question → tokenize → TFLite intent → TFLite entities → resolve → SQL
 */

import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';

// --- Model metadata (co-located in src/nlu/) ---
import intentLabelsJson from '../nlu/intent_labels.json';
import intentVocabJson from '../nlu/intent_vocab.json';
import entityLabelsJson from '../nlu/entity_labels.json';
import entityVocabJson from '../nlu/entity_vocab.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntentName =
  | 'count_transactions'
  | 'total_spent'
  | 'transactions_on_date'
  | 'category_spend'
  | 'list_transactions'
  | 'highest_transaction'
  | 'lowest_transaction'
  | 'average_spend'
  | 'monthly_summary';

export interface NLUResult {
  intent: IntentName;
  confidence: number;
  entities: Record<string, string>;
  sql: string;
  params: (string | number)[];
  /** Human-readable description of what the query does */
  description: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEQUENCE_LENGTH = 20;

const intentLabels: string[] = intentLabelsJson as string[];
const intentVocab: Record<string, number> = intentVocabJson as Record<string, number>;
const entityLabels: string[] = entityLabelsJson as string[];
const entityVocab: Record<string, number> = entityVocabJson as Record<string, number>;

/** Map short category names → canonical names matching the DB */
const CATEGORY_CANONICAL: Record<string, string> = {
  food: 'Food & Dining',
  dining: 'Food & Dining',
  restaurant: 'Food & Dining',
  'food and dining': 'Food & Dining',
  grocery: 'Groceries',
  groceries: 'Groceries',
  shopping: 'Shopping',
  transportation: 'Transportation',
  transport: 'Transportation',
  fuel: 'Transportation',
  entertainment: 'Entertainment',
  health: 'Health & Medical',
  medical: 'Health & Medical',
  'health and medical': 'Health & Medical',
  utilities: 'Utilities & Bills',
  bills: 'Utilities & Bills',
  'utilities and bills': 'Utilities & Bills',
  travel: 'Travel',
  education: 'Education',
  finance: 'Finance & Investment',
  investment: 'Finance & Investment',
  'finance and investment': 'Finance & Investment',
  transfers: 'Transfers',
  transfer: 'Transfers',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Model loading (singleton)
// ---------------------------------------------------------------------------

let intentModel: TensorflowModel | null = null;
let entityModel: TensorflowModel | null = null;
let _loading: Promise<void> | null = null;

/** Load both TFLite models. Safe to call multiple times. */
export async function initNLU(): Promise<void> {
  if (intentModel && entityModel) return;
  if (_loading) return _loading;

  _loading = (async () => {
    const [im, em] = await Promise.all([
      loadTensorflowModel(require('../../assets/models/intent_model.tflite')),
      loadTensorflowModel(require('../../assets/models/entity_model.tflite')),
    ]);
    intentModel = im;
    entityModel = em;
  })();

  return _loading;
}

/** Release model memory */
export function disposeNLU(): void {
  // Models are garbage-collected; reset references
  intentModel = null;
  entityModel = null;
  _loading = null;
}

// ---------------------------------------------------------------------------
// Tokenization
// ---------------------------------------------------------------------------

function tokenize(text: string, vocab: Record<string, number>): Int32Array {
  const words = text.toLowerCase().trim().split(/\s+/);
  const seq = new Int32Array(SEQUENCE_LENGTH);
  for (let i = 0; i < Math.min(words.length, SEQUENCE_LENGTH); i++) {
    seq[i] = vocab[words[i]] ?? 1; // 1 = <UNK>
  }
  // Rest stays 0 = <PAD>
  return seq;
}

// ---------------------------------------------------------------------------
// Intent classification
// ---------------------------------------------------------------------------

function predictIntent(text: string): { intent: IntentName; confidence: number } {
  if (!intentModel) throw new Error('NLU not initialized — call initNLU() first');

  const input = tokenize(text, intentVocab);
  const output = intentModel.runSync([input]);
  const probs = output[0] as Float32Array;

  let maxIdx = 0;
  let maxVal = probs[0];
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > maxVal) {
      maxVal = probs[i];
      maxIdx = i;
    }
  }

  return {
    intent: intentLabels[maxIdx] as IntentName,
    confidence: maxVal,
  };
}

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

function predictEntities(text: string): Record<string, string> {
  if (!entityModel) throw new Error('NLU not initialized — call initNLU() first');

  const words = text.toLowerCase().trim().split(/\s+/);
  const input = tokenize(text, entityVocab);
  const output = entityModel.runSync([input]);
  const tagProbs = output[0] as Float32Array; // flat: SEQUENCE_LENGTH * numTags

  const numTags = entityLabels.length;
  const entities: Record<string, string> = {};
  let currentEntity: string | null = null;
  let currentWords: string[] = [];

  for (let i = 0; i < Math.min(words.length, SEQUENCE_LENGTH); i++) {
    // Find best tag for this position
    let bestTag = 0;
    let bestVal = tagProbs[i * numTags];
    for (let t = 1; t < numTags; t++) {
      if (tagProbs[i * numTags + t] > bestVal) {
        bestVal = tagProbs[i * numTags + t];
        bestTag = t;
      }
    }

    const tag = entityLabels[bestTag];

    if (tag.startsWith('B-')) {
      // Save previous entity
      if (currentEntity && currentWords.length > 0) {
        entities[currentEntity.toLowerCase()] = currentWords.join(' ');
      }
      currentEntity = tag.slice(2);
      currentWords = [words[i]];
    } else if (tag.startsWith('I-') && currentEntity === tag.slice(2)) {
      currentWords.push(words[i]);
    } else {
      if (currentEntity && currentWords.length > 0) {
        entities[currentEntity.toLowerCase()] = currentWords.join(' ');
      }
      currentEntity = null;
      currentWords = [];
    }
  }

  // Flush last entity
  if (currentEntity && currentWords.length > 0) {
    entities[currentEntity.toLowerCase()] = currentWords.join(' ');
  }

  return entities;
}

// ---------------------------------------------------------------------------
// Date resolution
// ---------------------------------------------------------------------------

function resolveDate(dateStr: string): { from: string; to: string } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d: Date) => d.toISOString().split('T')[0]; // YYYY-MM-DD

  const lower = dateStr.toLowerCase().trim();

  if (lower === 'today') {
    return { from: fmt(today), to: fmt(today) };
  }

  if (lower === 'yesterday') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return { from: fmt(d), to: fmt(d) };
  }

  // "X days ago"
  const daysAgoMatch = lower.match(/(\d+)\s*days?\s*ago/);
  if (daysAgoMatch) {
    const d = new Date(today);
    d.setDate(d.getDate() - parseInt(daysAgoMatch[1], 10));
    return { from: fmt(d), to: fmt(d) };
  }

  if (lower === 'this week') {
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    return { from: fmt(weekStart), to: fmt(today) };
  }

  if (lower === 'last week') {
    const dayOfWeek = today.getDay();
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - dayOfWeek);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
    return { from: fmt(lastWeekStart), to: fmt(lastWeekEnd) };
  }

  if (lower === 'this month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: fmt(monthStart), to: fmt(today) };
  }

  if (lower === 'last month') {
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: fmt(lastMonthStart), to: fmt(lastMonthEnd) };
  }

  if (lower === 'this year') {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return { from: fmt(yearStart), to: fmt(today) };
  }

  if (lower === 'last year') {
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
    return { from: fmt(lastYearStart), to: fmt(lastYearEnd) };
  }

  // Month names: "january", "february", etc.
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const monthIdx = months.indexOf(lower);
  if (monthIdx !== -1) {
    // Assume current year if month hasn't passed, else current year
    const year = now.getFullYear();
    const monthStart = new Date(year, monthIdx, 1);
    const monthEnd = new Date(year, monthIdx + 1, 0);
    return { from: fmt(monthStart), to: fmt(monthEnd) };
  }

  // Day of week: "monday", "tuesday", etc.
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIdx = days.indexOf(lower);
  if (dayIdx !== -1) {
    const d = new Date(today);
    const diff = (today.getDay() - dayIdx + 7) % 7 || 7; // most recent occurrence
    d.setDate(today.getDate() - diff);
    return { from: fmt(d), to: fmt(d) };
  }

  // "last monday", "last friday"
  const lastDayMatch = lower.match(/^last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (lastDayMatch) {
    const targetDay = days.indexOf(lastDayMatch[1]);
    const d = new Date(today);
    const diff = (today.getDay() - targetDay + 7) % 7 || 7;
    d.setDate(today.getDate() - diff);
    return { from: fmt(d), to: fmt(d) };
  }

  return null;
}

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

function buildQuery(
  intent: IntentName,
  entities: Record<string, string>,
): { sql: string; params: (string | number)[]; description: string } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Merchant filter → search in description
  if (entities.merchant) {
    conditions.push('description LIKE ?');
    params.push(`%${entities.merchant}%`);
  }

  // Category filter
  if (entities.category) {
    const canonical = CATEGORY_CANONICAL[entities.category] ?? entities.category;
    conditions.push('category = ?');
    params.push(canonical);
  }

  // Amount filter
  if (entities.amount) {
    const numbers = entities.amount.match(/\d+/);
    if (numbers) {
      const num = parseInt(numbers[0], 10);
      const str = entities.amount;
      if (/above|over|more|greater/.test(str)) {
        conditions.push('amount > ?');
        params.push(num);
      } else if (/below|under|less/.test(str)) {
        conditions.push('amount < ?');
        params.push(num);
      }
    }
  }

  // Date filter
  if (entities.date) {
    const resolved = resolveDate(entities.date);
    if (resolved) {
      conditions.push('date BETWEEN ? AND ?');
      params.push(resolved.from, resolved.to);
    }
  }

  const where = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

  let sql: string;
  let description: string;

  switch (intent) {
    case 'count_transactions':
      sql = `SELECT COUNT(*) as result FROM transactions WHERE ${where}`;
      description = 'Counting transactions';
      break;
    case 'total_spent':
      sql = `SELECT COALESCE(SUM(amount), 0) as result FROM transactions WHERE type='debit' AND ${where}`;
      description = 'Calculating total spending';
      break;
    case 'list_transactions':
      sql = `SELECT * FROM transactions WHERE ${where} ORDER BY date DESC LIMIT 20`;
      description = 'Listing transactions';
      break;
    case 'highest_transaction':
      sql = `SELECT * FROM transactions WHERE type='debit' AND ${where} ORDER BY amount DESC LIMIT 1`;
      description = 'Finding highest transaction';
      break;
    case 'lowest_transaction':
      sql = `SELECT * FROM transactions WHERE type='debit' AND ${where} ORDER BY amount ASC LIMIT 1`;
      description = 'Finding lowest transaction';
      break;
    case 'average_spend':
      sql = `SELECT COALESCE(AVG(amount), 0) as result FROM transactions WHERE type='debit' AND ${where}`;
      description = 'Calculating average spending';
      break;
    case 'category_spend':
      sql = `SELECT category, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE type='debit' AND ${where} GROUP BY category ORDER BY total DESC`;
      description = 'Breaking down spending by category';
      break;
    case 'transactions_on_date':
      sql = `SELECT * FROM transactions WHERE ${where} ORDER BY date DESC`;
      description = 'Showing transactions for the date';
      break;
    case 'monthly_summary':
      sql = `SELECT strftime('%Y-%m', date) as month, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE type='debit' AND ${where} GROUP BY month ORDER BY month DESC`;
      description = 'Generating monthly summary';
      break;
    default:
      sql = `SELECT * FROM transactions WHERE ${where} ORDER BY date DESC LIMIT 20`;
      description = 'Listing transactions';
  }

  // Build human-readable description
  const parts: string[] = [description];
  if (entities.merchant) parts.push(`for "${entities.merchant}"`);
  if (entities.category)
    parts.push(`in ${CATEGORY_CANONICAL[entities.category] ?? entities.category}`);
  if (entities.date) parts.push(`(${entities.date})`);
  if (entities.amount) parts.push(`with amount ${entities.amount}`);

  return { sql, params, description: parts.join(' ') };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Process a natural language query and return structured NLU result.
 *
 * @example
 * ```ts
 * await initNLU();
 * const result = processQuery("how many swiggy transactions last month");
 * // result.intent = "count_transactions"
 * // result.entities = { merchant: "swiggy", date: "last month" }
 * // result.sql = "SELECT COUNT(*) as result FROM transactions WHERE description LIKE ? AND date BETWEEN ? AND ?"
 * // result.params = ["%swiggy%", "2026-02-01", "2026-02-28"]
 * ```
 */
export function processQuery(text: string): NLUResult {
  const { intent, confidence } = predictIntent(text);
  const entities = predictEntities(text);
  const { sql, params, description } = buildQuery(intent, entities);

  return { intent, confidence, entities, sql, params, description };
}
