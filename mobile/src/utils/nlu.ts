/**
 * On-device NLU engine for Vector expense app.
 *
 * Loads two TFLite models (intent classifier + entity extractor) and converts
 * natural language queries into structured SQL queries against the transactions table.
 *
 * Pipeline:  User question → spellcheck → tokenize → TFLite intent → TFLite entities → resolve → SQL
 */

import { Platform } from 'react-native';
import { closest, distance } from 'fastest-levenshtein';

let loadTensorflowModel: typeof import('react-native-fast-tflite').loadTensorflowModel;
type TensorflowModel = import('react-native-fast-tflite').TensorflowModel;

let _tfliteImportError: string | null = null;

try {
  loadTensorflowModel = require('react-native-fast-tflite').loadTensorflowModel;
} catch (e: any) {
  _tfliteImportError = e?.message ?? 'Unknown import error';
  console.error('[NLU] Failed to import react-native-fast-tflite:', e);
}

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
  | 'monthly_summary'
  | 'compare_months'
  | 'top_category'
  | 'spending_health'
  | 'frequent_merchant'
  | 'unusual_spend'
  | 'weekly_summary';

export interface NLUResult {
  intent: IntentName;
  confidence: number;
  entities: Record<string, string>;
  sql: string;
  params: (string | number)[];
  /** Human-readable description of what the query does */
  description: string;
}

export interface CardInfo {
  id: string;
  issuer: string;
  nickname: string;
  last4: string;
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

/** Map spoken card names → canonical issuer names */
const CARD_CANONICAL: Record<string, string> = {
  // Indian banks
  sbi: 'SBI',
  'sbi card': 'SBI',
  'state bank': 'SBI',
  hdfc: 'HDFC',
  'hdfc bank': 'HDFC',
  'hdfc credit': 'HDFC',
  icici: 'ICICI',
  'icici bank': 'ICICI',
  axis: 'Axis',
  'axis bank': 'Axis',
  kotak: 'Kotak',
  'kotak mahindra': 'Kotak',
  indusind: 'IndusInd',
  'yes bank': 'Yes Bank',
  'yes bank card': 'Yes Bank',
  rbl: 'RBL',
  bob: 'BOB',
  'bob card': 'BOB',
  'bank of baroda': 'BOB',
  canara: 'Canara',
  pnb: 'PNB',
  'pnb card': 'PNB',
  idbi: 'IDBI',
  federal: 'Federal',
  bandhan: 'Bandhan',
  'au small finance': 'AU Small Finance',
  'idfc first': 'IDFC First',
  idfc: 'IDFC First',
  // US banks
  chase: 'Chase',
  bofa: 'Bank of America',
  'bank of america': 'Bank of America',
  'wells fargo': 'Wells Fargo',
  citi: 'Citi',
  citibank: 'Citi',
  'capital one': 'Capital One',
  'capital one card': 'Capital One',
  amex: 'Amex',
  'american express': 'Amex',
  discover: 'Discover',
  'us bank': 'US Bank',
  'barclays us': 'Barclays',
  synchrony: 'Synchrony',
  // UK banks
  barclays: 'Barclays',
  hsbc: 'HSBC',
  'hsbc india': 'HSBC',
  lloyds: 'Lloyds',
  natwest: 'NatWest',
  'santander uk': 'Santander',
  santander: 'Santander',
  monzo: 'Monzo',
  revolut: 'Revolut',
  starling: 'Starling',
};

// ---------------------------------------------------------------------------
// Spell correction
// ---------------------------------------------------------------------------

/** Merge both vocabs into a single word list for spell correction */
const _allVocabWords: string[] = (() => {
  const wordSet = new Set<string>();
  for (const w of Object.keys(intentVocab)) {
    if (w !== '<PAD>' && w !== '<UNK>') wordSet.add(w);
  }
  for (const w of Object.keys(entityVocab)) {
    if (w !== '<PAD>' && w !== '<UNK>') wordSet.add(w);
  }

  // Add extra domain words that may not be in the model vocab but users type
  const extraWords = [
    // Common query words
    'transactions', 'transaction', 'expenses', 'expense', 'payments', 'payment',
    'purchases', 'purchase', 'orders', 'order', 'spending', 'spent',
    'category', 'categories', 'merchant', 'merchants',
    'monthly', 'weekly', 'daily', 'yearly',
    'compare', 'comparison', 'breakdown', 'summary', 'average',
    'highest', 'lowest', 'biggest', 'smallest', 'total',
    // Amount modifiers
    'more', 'less', 'than', 'above', 'below', 'over', 'under', 'greater', 'between',
    // Common misspelled targets
    'shopping', 'groceries', 'grocery', 'entertainment', 'transportation',
    'utilities', 'education', 'dining', 'restaurant', 'travel', 'health', 'medical',
    'finance', 'investment', 'transfers', 'transfer',
  ];
  for (const w of extraWords) wordSet.add(w);

  return Array.from(wordSet);
})();

const _vocabSet = new Set(_allVocabWords);

/** Max Levenshtein distance to accept a correction */
const MAX_EDIT_DISTANCE = 2;

/** Words that should never be "corrected" — numbers, single chars, etc. */
function shouldSkipCorrection(word: string): boolean {
  // Skip numbers and words with digits (e.g. "500", "10k")
  if (/\d/.test(word)) return true;
  // Skip very short words (1-2 chars) — too ambiguous
  if (word.length <= 2) return true;
  // Skip if already in vocab
  if (_vocabSet.has(word)) return true;
  return false;
}

/**
 * Correct spelling of a user query against the NLU vocabulary.
 * Uses Levenshtein distance (via fastest-levenshtein) to find the nearest
 * vocab word for each unknown word. Returns the corrected text.
 *
 * Only corrects words within MAX_EDIT_DISTANCE (2) to avoid over-correction.
 */
function correctSpelling(text: string): string {
  const words = text.toLowerCase().trim().split(/\s+/);
  let corrected = false;

  const result = words.map((word) => {
    if (shouldSkipCorrection(word)) return word;

    const match = closest(word, _allVocabWords);
    const dist = distance(word, match);

    // Only correct if distance is small relative to word length
    // Short words (3-4 chars): max distance 1
    // Longer words (5+): max distance 2
    const maxDist = word.length <= 4 ? 1 : MAX_EDIT_DISTANCE;

    if (dist > 0 && dist <= maxDist) {
      corrected = true;
      return match;
    }

    return word;
  });

  if (corrected) {
    const correctedText = result.join(' ');
    console.log(`[NLU] Spell corrected: "${text}" → "${correctedText}"`);
    return correctedText;
  }

  return text;
}

// ---------------------------------------------------------------------------
// Model loading (singleton)
// ---------------------------------------------------------------------------

let intentModel: TensorflowModel | null = null;
let entityModel: TensorflowModel | null = null;
let _loading: Promise<void> | null = null;

/**
 * Try loading a TFLite model with delegate fallback.
 * On iOS: try CoreML → Metal → CPU. On Android: try GPU → CPU.
 */
async function loadModelWithFallback(
  source: number,
): ReturnType<typeof loadTensorflowModel> {
  const delegates =
    Platform.OS === 'ios'
      ? (['core-ml', 'metal', 'default'] as const)
      : (['default'] as const);

  for (const delegate of delegates) {
    try {
      const model = await loadTensorflowModel(source, delegate);
      console.log(`[NLU] Model loaded with delegate: ${delegate}`);
      return model;
    } catch (e: any) {
      console.warn(`[NLU] ${delegate} delegate failed: ${e?.message}`);
    }
  }

  throw new Error('Failed to load TFLite model with any delegate');
}

/** Load both TFLite models. Safe to call multiple times. */
export async function initNLU(): Promise<void> {
  if (intentModel && entityModel) return;
  if (_loading) return _loading;

  if (!loadTensorflowModel) {
    throw new Error(
      `TFLite native module not available. ${_tfliteImportError ? `Reason: ${_tfliteImportError}` : 'The native module was not found — did you rebuild the native app?'}`,
    );
  }

  _loading = (async () => {
    if (typeof (global as any).__loadTensorflowModel !== 'function') {
      throw new Error(
        'TFLite JSI bindings failed to install. This may require New Architecture (RN 0.76+).',
      );
    }

    const [im, em] = await Promise.all([
      loadModelWithFallback(require('../../assets/models/intent_model.tflite')),
      loadModelWithFallback(require('../../assets/models/entity_model.tflite')),
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

  return cleanEntities(entities, text);
}

// ---------------------------------------------------------------------------
// Entity post-processing
// ---------------------------------------------------------------------------

/** Words that should never be treated as merchants — common false positives */
const STOP_MERCHANTS = new Set([
  'wise', 'category', 'categories', 'month', 'months', 'weekly',
  'daily', 'total', 'average', 'more', 'less', 'above', 'below',
  'over', 'under', 'than', 'transaction', 'transactions', 'expense',
  'expenses', 'payment', 'payments', 'summary', 'breakdown', 'compare',
  'comparison', 'highest', 'lowest', 'biggest', 'smallest',
]);

/**
 * Post-process extracted entities: remove false positives and fix typos.
 */
function cleanEntities(
  entities: Record<string, string>,
  originalText: string,
): Record<string, string> {
  const lower = originalText.toLowerCase();

  // Remove merchant if it's a stop word (e.g. "wise" from "category wise")
  if (entities.merchant && STOP_MERCHANTS.has(entities.merchant.toLowerCase())) {
    delete entities.merchant;
  }

  // Fix amount entity for typos: "less tan 500" → "less than 500"
  // Tolerates: "tan"/"then"/"thn" for "than", "grater" for "greater"
  const AMOUNT_MODIFIER_RE =
    /\b(more\s+t[ah]*[ne]?n?|above|over|greater\s+t[ah]*[ne]?n?|grater\s+t[ah]*[ne]?n?|less\s+t[ah]*[ne]?n?|below|under)\s+(\d[\d,]*)/;

  if (entities.amount) {
    const hasNumber = /\d/.test(entities.amount);
    if (!hasNumber) {
      // Try to find amount pattern in the original text with typo tolerance
      const amountMatch = lower.match(AMOUNT_MODIFIER_RE);
      if (amountMatch) {
        entities.amount = amountMatch[0];
      } else {
        // No usable amount — remove it to avoid broken SQL
        delete entities.amount;
      }
    }
  }

  // If no amount entity but text clearly has an amount-filter pattern (handles typos)
  if (!entities.amount) {
    const typoAmountMatch = lower.match(AMOUNT_MODIFIER_RE);
    if (typoAmountMatch) {
      entities.amount = typoAmountMatch[0];
    }
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
// Card resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a spoken card name (e.g. "sbi", "hdfc credit card") to a user's
 * actual cardId UUID by matching against their CreditCard.issuer field.
 *
 * Resolution order: canonical mapping → exact issuer → partial issuer → nickname → last4
 */
function resolveCard(
  cardText: string,
  cards: CardInfo[],
): { cardId: string; label: string } | null {
  if (!cards || cards.length === 0) return null;

  // Strip trailing "credit card" / "debit card" / "card"
  const cleaned = cardText
    .replace(/\s*(credit|debit)?\s*card$/i, '')
    .trim()
    .toLowerCase();

  // Map to canonical issuer name
  const canonical = (CARD_CANONICAL[cleaned] ?? cleaned).toLowerCase();

  // Try exact issuer match (case-insensitive)
  for (const c of cards) {
    if (c.issuer.toLowerCase() === canonical) {
      return { cardId: c.id, label: c.nickname || c.issuer };
    }
  }

  // Partial issuer match (issuer contains canonical or vice versa)
  for (const c of cards) {
    const issuerLower = c.issuer.toLowerCase();
    if (issuerLower.includes(canonical) || canonical.includes(issuerLower)) {
      return { cardId: c.id, label: c.nickname || c.issuer };
    }
  }

  // Nickname match
  for (const c of cards) {
    if (c.nickname && c.nickname.toLowerCase().includes(cleaned)) {
      return { cardId: c.id, label: c.nickname };
    }
  }

  // Last4 match
  for (const c of cards) {
    if (c.last4 && cleaned.includes(c.last4)) {
      return { cardId: c.id, label: c.nickname || `****${c.last4}` };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Rule-based intent correction
// ---------------------------------------------------------------------------

/**
 * Post-model correction: override the TFLite intent when clear textual
 * patterns + entity signals indicate a different intent.  This catches
 * common misclassifications (e.g. "transactions more than 500" → compare_months)
 * without requiring a full retrain.
 */
function correctIntent(
  text: string,
  intent: IntentName,
  confidence: number,
  entities: Record<string, string>,
): { intent: IntentName; confidence: number } {
  const lower = text.toLowerCase().trim();

  // ── Category-wise / category breakdown ───────────────────────────────
  // "category wise transactions", "last month categories transaction",
  // "spending by category", "categorywise breakdown", etc.
  const categoryBreakdownRe =
    /\b(categor(y|ies)\s*(wise|breakdown|split|distribution|summary)|by\s+categor(y|ies)|categor(y|ies)\s+wise)\b/;
  if (categoryBreakdownRe.test(lower) && intent !== 'category_spend' && intent !== 'top_category') {
    return { intent: 'category_spend', confidence: Math.max(confidence, 0.90) };
  }
  // Also catch: "<date> categories transaction" pattern
  if (
    /\bcategor(y|ies)\b/.test(lower) &&
    /\btransactions?\b/.test(lower) &&
    intent !== 'category_spend' &&
    intent !== 'top_category'
  ) {
    return { intent: 'category_spend', confidence: Math.max(confidence, 0.88) };
  }

  // ── Amount-filtered listing ──────────────────────────────────────────
  // Patterns: "transactions more than 500", "expenses above 1000",
  //           "transactions under 200", "purchases below 500"
  // Also handles typos: "less tan", "more then", "grater than"
  const amountFilterRe =
    /\b(transactions?|expenses?|payments?|purchases?|spends?|orders?)\b.*\b(more\s+t[ah]*[ne]?n?|above|over|greater\s+t[ah]*[ne]?n?|grater\s+t[ah]*[ne]?n?|less\s+t[ah]*[ne]?n?|below|under|between)\b.*\d/;
  if (
    amountFilterRe.test(lower) &&
    intent !== 'list_transactions' &&
    intent !== 'count_transactions' &&
    intent !== 'total_spent' &&
    intent !== 'highest_transaction' &&
    intent !== 'lowest_transaction'
  ) {
    const isCount = /\b(how\s+many|count|number\s+of)\b/.test(lower);
    const isTotal = /\b(total|sum|how\s+much)\b/.test(lower);
    return {
      intent: isCount ? 'count_transactions' : isTotal ? 'total_spent' : 'list_transactions',
      confidence: Math.max(confidence, 0.85),
    };
  }

  // ── Bare "transactions <amount-modifier> <number>" ───────────────────
  // Very short queries like "transactions above 500" or "transactions > 500"
  const bareAmountRe =
    /^(show\s+|list\s+|get\s+|find\s+)?(all\s+)?(my\s+)?\w*\s*(transactions?|expenses?|payments?)(\s+(more|greater|grater|less|above|over|below|under)\s+(t[ah]*[ne]?n?\s+)?\d+|\s*[><]=?\s*\d+)/;
  if (bareAmountRe.test(lower) && intent !== 'list_transactions') {
    return { intent: 'list_transactions', confidence: Math.max(confidence, 0.90) };
  }

  // ── "show/list transactions" with no comparison keywords ─────────────
  const listRe = /^(show|list|display|get|find|pull\s+up)\s+(me\s+)?(my\s+)?(all\s+)?(recent\s+)?(transactions?|expenses?|payments?|purchases?|orders?)\b/;
  if (
    listRe.test(lower) &&
    intent !== 'list_transactions' &&
    intent !== 'transactions_on_date' &&
    !/\b(compar|vs|versus|month\s+over|month\s+to|trend|categor)/i.test(lower)
  ) {
    return { intent: 'list_transactions', confidence: Math.max(confidence, 0.85) };
  }

  // ── "how many" clearly indicates count ───────────────────────────────
  if (/\b(how\s+many|count)\b/.test(lower) && intent !== 'count_transactions') {
    return { intent: 'count_transactions', confidence: Math.max(confidence, 0.85) };
  }

  // ── "total spent" / "how much" clearly indicates total ───────────────
  if (
    /\b(total\s+spent|how\s+much\s+(did\s+I|have\s+I)?\s*spend|sum\s+of)\b/.test(lower) &&
    intent !== 'total_spent'
  ) {
    return { intent: 'total_spent', confidence: Math.max(confidence, 0.85) };
  }

  // ── "biggest" / "highest" / "largest" → highest_transaction ──────────
  // But NOT when "categories" is in the query (that's category_spend)
  if (
    /\b(biggest|highest|largest|most\s+expensive|maximum|costliest|priciest)\b/.test(lower) &&
    !/\bcategor/i.test(lower) &&
    intent !== 'highest_transaction'
  ) {
    return { intent: 'highest_transaction', confidence: Math.max(confidence, 0.85) };
  }

  // ── "smallest" / "lowest" / "cheapest" → lowest_transaction ──────────
  if (
    /\b(smallest|lowest|cheapest|least\s+expensive|minimum)\b/.test(lower) &&
    !/\bcategor/i.test(lower) &&
    intent !== 'lowest_transaction'
  ) {
    return { intent: 'lowest_transaction', confidence: Math.max(confidence, 0.85) };
  }

  return { intent, confidence };
}

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

function buildQuery(
  intent: IntentName,
  entities: Record<string, string>,
  cards?: CardInfo[],
  originalText?: string,
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

  // Amount filter — use entity if available, else fallback to regex on original text
  // Typo-tolerant: "tan"/"then"/"thn" for "than", "grater" for "greater"
  let amountStr = entities.amount;
  if (!amountStr && originalText) {
    const fallback = originalText.match(
      /\b(more\s+t[ah]*[ne]?n?|above|over|greater\s+t[ah]*[ne]?n?|grater\s+t[ah]*[ne]?n?|less\s+t[ah]*[ne]?n?|below|under)\s+(\d[\d,]*)/i,
    );
    if (fallback) {
      amountStr = fallback[0];
      entities.amount = amountStr;
    }
  }

  if (amountStr) {
    const numbers = amountStr.match(/\d[\d,]*/);
    if (numbers) {
      const num = parseInt(numbers[0].replace(/,/g, ''), 10);
      const str = amountStr;
      if (/above|over|more|greater|grater/i.test(str)) {
        conditions.push('amount > ?');
        params.push(num);
      } else if (/below|under|less/i.test(str)) {
        conditions.push('amount < ?');
        params.push(num);
      }
    }
  }

  // Card filter → resolve to cardId
  let resolvedCard: { cardId: string; label: string } | null = null;
  if (entities.card && cards) {
    resolvedCard = resolveCard(entities.card, cards);
    if (resolvedCard) {
      conditions.push('cardId = ?');
      params.push(resolvedCard.cardId);
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
    case 'compare_months':
      sql = `SELECT strftime('%Y-%m', date) as month, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE type='debit' AND ${where} GROUP BY month ORDER BY month DESC LIMIT 2`;
      description = 'Comparing monthly spending';
      break;
    case 'top_category':
      sql = `SELECT category, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE type='debit' AND ${where} GROUP BY category ORDER BY total DESC LIMIT 5`;
      description = 'Finding top spending categories';
      break;
    case 'spending_health':
      sql = `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count, COALESCE(ROUND(AVG(amount), 2), 0) as avg_amount, COALESCE(MAX(amount), 0) as max_amount FROM transactions WHERE type='debit' AND ${where}`;
      description = 'Analyzing spending health';
      break;
    case 'frequent_merchant':
      sql = `SELECT description, COUNT(*) as visit_count, SUM(amount) as total FROM transactions WHERE type='debit' AND ${where} GROUP BY description ORDER BY visit_count DESC LIMIT 10`;
      description = 'Finding most frequent merchants';
      break;
    case 'unusual_spend':
      sql = `SELECT *, (SELECT ROUND(AVG(amount), 2) FROM transactions WHERE type='debit') as _avg FROM transactions WHERE type='debit' AND amount > (SELECT AVG(amount) * 2 FROM transactions WHERE type='debit') AND ${where} ORDER BY amount DESC LIMIT 10`;
      description = 'Finding unusual transactions';
      break;
    case 'weekly_summary':
      if (!entities.date) {
        sql = `SELECT date, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE type='debit' AND date >= date('now', '-7 days') AND ${where} GROUP BY date ORDER BY date`;
      } else {
        sql = `SELECT date, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE type='debit' AND ${where} GROUP BY date ORDER BY date`;
      }
      description = 'Weekly spending breakdown';
      break;
    default:
      sql = `SELECT * FROM transactions WHERE ${where} ORDER BY date DESC LIMIT 20`;
      description = 'Listing transactions';
  }

  // Build human-readable description
  const parts: string[] = [description];
  if (resolvedCard) parts.push(`on ${resolvedCard.label} card`);
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
export function processQuery(text: string, cards?: CardInfo[]): NLUResult {
  // Step 1: Spell correction — fix typos before ML inference
  const corrected = correctSpelling(text);

  // Step 2: ML inference on corrected text
  const raw = predictIntent(corrected);
  const entities = predictEntities(corrected);

  // Step 3: Rule-based intent correction using corrected text + entities
  const { intent, confidence } = correctIntent(corrected, raw.intent, raw.confidence, entities);

  // Step 4: SQL generation (pass original text as fallback for amount extraction)
  const { sql, params, description } = buildQuery(intent, entities, cards, text);

  return { intent, confidence, entities, sql, params, description };
}
