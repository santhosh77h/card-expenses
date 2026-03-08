import type { CurrencyCode } from '../theme';
import type { CreditCard } from '../store';

export const ISSUERS = ['HDFC Bank', 'ICICI Bank', 'SBI Card', 'Axis Bank', 'Chase', 'American Express', 'Citi', 'Other'];
export const NETWORKS = ['Visa', 'Mastercard', 'American Express', 'RuPay'];

export const ISSUER_CURRENCY: Record<string, CurrencyCode> = {
  'HDFC Bank': 'INR', 'ICICI Bank': 'INR', 'SBI Card': 'INR', 'Axis Bank': 'INR',
  'Chase': 'USD', 'Citi': 'USD', 'American Express': 'INR', 'Other': 'INR',
};

export const CARD_COLORS = [
  '#1E3A5F', '#2D1B69', '#1B4332', '#4A1942', '#1C1C1C',
  '#0F3460', '#3C1518', '#1A535C',
];

export const BANK_TO_ISSUER: Record<string, string> = {
  hdfc: 'HDFC Bank', icici: 'ICICI Bank', sbi: 'SBI Card',
  axis: 'Axis Bank', chase: 'Chase', amex: 'American Express',
  citi: 'Citi', generic: 'Other', demo: 'Other',
};

export function normalizeNetwork(network: string | null): string {
  if (!network) return 'Visa';
  const lower = network.toLowerCase();
  if (lower.includes('master')) return 'Mastercard';
  if (lower.includes('amex') || lower.includes('american')) return 'American Express';
  if (lower.includes('rupay')) return 'RuPay';
  return 'Visa';
}

export function pickUnusedColor(existingCards: CreditCard[]): string {
  const used = new Set(existingCards.map((c) => c.color));
  return CARD_COLORS.find((c) => !used.has(c)) || CARD_COLORS[0];
}
