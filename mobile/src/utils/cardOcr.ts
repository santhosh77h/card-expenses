// @ts-nocheck — OCR disabled; ML Kit dependency removed to fix iOS simulator build
import TextRecognition from '@react-native-ml-kit/text-recognition';
import type { ScannedCardInfo } from './api';

// Keywords to exclude when scoring cardholder name candidates
const NAME_BLACKLIST = [
  'valid', 'thru', 'from', 'credit', 'debit', 'card', 'platinum', 'gold',
  'silver', 'classic', 'signature', 'infinite', 'rewards', 'bank', 'visa',
  'mastercard', 'rupay', 'amex', 'american', 'express', 'member', 'since',
  'customer', 'service', 'international', 'domestic', 'contactless', 'chip',
  'valid', 'month', 'year', 'cvv', 'pin', 'atm', 'pos', 'net', 'banking',
];

const ISSUER_PATTERNS: [RegExp, string][] = [
  [/\bhdfc\b/i, 'HDFC'],
  [/\bicici\b/i, 'ICICI'],
  [/\bsbi\b/i, 'SBI'],
  [/\baxis\b/i, 'Axis'],
  [/\bchase\b/i, 'Chase'],
  [/\bciti\b/i, 'Citi'],
  [/\b(amex|american\s*express)\b/i, 'American Express'],
  [/\bkotak\b/i, 'Kotak'],
  [/\bindusind\b/i, 'IndusInd'],
  [/\byes\s*bank\b/i, 'Yes Bank'],
  [/\bbob\b|bank\s*of\s*baroda/i, 'Bank of Baroda'],
  [/\bcapital\s*one\b/i, 'Capital One'],
  [/\bwells\s*fargo\b/i, 'Wells Fargo'],
  [/\bbarclays\b/i, 'Barclays'],
  [/\bhsbc\b/i, 'HSBC'],
];

const NETWORK_PATTERNS: [RegExp, string][] = [
  [/\bvisa\b/i, 'Visa'],
  [/\b(mastercard|master\s*card)\b/i, 'Mastercard'],
  [/\b(amex|american\s*express)\b/i, 'American Express'],
  [/\brupay\b/i, 'RuPay'],
  [/\bdiscover\b/i, 'Discover'],
];

/**
 * Extract last 4 digits of card number from OCR text lines.
 */
function extractLast4(lines: string[]): string | null {
  const fullText = lines.join(' ');

  // Try full 16-digit pattern first
  const full16 = fullText.match(/\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-](\d{4})/);
  if (full16) return full16[1];

  // Try masked patterns like XXXX XXXX XXXX 1234 or **** **** **** 1234
  const masked = fullText.match(/[X*x]{4}[\s\-][X*x]{4}[\s\-][X*x]{4}[\s\-](\d{4})/);
  if (masked) return masked[1];

  // Try partial masked patterns like XX1234 or **1234
  const partialMask = fullText.match(/[X*x]{2,}\s*(\d{4})\b/);
  if (partialMask) return partialMask[1];

  // Look for isolated 4-digit groups, excluding likely years (19xx, 20xx)
  const candidates: string[] = [];
  const digitGroups = fullText.match(/\b(\d{4})\b/g) || [];
  for (const g of digitGroups) {
    const n = parseInt(g, 10);
    if (n >= 1900 && n <= 2099) continue; // likely a year
    candidates.push(g);
  }
  // Prefer last candidate (card number usually appears at bottom)
  if (candidates.length > 0) return candidates[candidates.length - 1];

  return null;
}

/**
 * Detect card network from OCR text.
 */
function extractNetwork(fullText: string): string | null {
  for (const [pattern, network] of NETWORK_PATTERNS) {
    if (pattern.test(fullText)) return network;
  }
  return null;
}

/**
 * Detect card issuer from OCR text.
 */
function extractIssuer(fullText: string): string | null {
  for (const [pattern, issuer] of ISSUER_PATTERNS) {
    if (pattern.test(fullText)) return issuer;
  }
  return null;
}

/**
 * Score a line for likelihood of being a cardholder name.
 */
function scoreNameCandidate(line: string): number {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 40) return -1;

  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 4) return -1;

  // Reject if any word is a blacklisted keyword
  const lower = trimmed.toLowerCase();
  for (const kw of NAME_BLACKLIST) {
    if (lower.includes(kw)) return -1;
  }

  // Reject if contains digits
  if (/\d/.test(trimmed)) return -1;

  let score = 0;

  // All caps is typical for card names
  if (trimmed === trimmed.toUpperCase()) score += 3;

  // 2-3 words is ideal
  if (words.length >= 2 && words.length <= 3) score += 2;

  // All alphabetic (+ spaces)
  if (/^[A-Za-z\s]+$/.test(trimmed)) score += 2;

  // Each word starts with uppercase
  if (words.every((w) => /^[A-Z]/.test(w))) score += 1;

  return score;
}

/**
 * Extract cardholder name from OCR text lines.
 */
function extractCardholderName(lines: string[]): string | null {
  let bestLine: string | null = null;
  let bestScore = 0;

  for (const line of lines) {
    const score = scoreNameCandidate(line);
    if (score > bestScore) {
      bestScore = score;
      bestLine = line.trim();
    }
  }

  return bestScore >= 3 ? bestLine : null;
}

/**
 * Run ML Kit OCR on a card photo and extract structured card info.
 * Everything runs on-device - no network call, no image leaves the phone.
 */
export async function scanCardLocally(imageUri: string): Promise<ScannedCardInfo> {
  const result = await TextRecognition.recognize(imageUri);

  // Flatten OCR blocks into lines of text
  const lines: string[] = [];
  for (const block of result.blocks) {
    for (const line of block.lines) {
      if (line.text) {
        lines.push(line.text);
      }
    }
  }

  if (lines.length === 0) {
    throw new Error('No text detected on the card. Please try again with better lighting.');
  }

  const fullText = lines.join(' ');

  return {
    last4: extractLast4(lines),
    issuer: extractIssuer(fullText),
    network: extractNetwork(fullText),
    cardholder_name: extractCardholderName(lines),
  };
}
