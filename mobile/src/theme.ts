export const colors = {
  background: '#0A0E1A',
  surface: '#111827',
  surfaceElevated: '#1C2333',
  accent: '#00E5A0',
  debit: '#FF5C5C',
  credit: '#00E5A0',
  warning: '#FFB547',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  border: '#1F2937',
  tabBarBg: '#111827',
  tabBarActive: '#00E5A0',
  tabBarInactive: '#6B7280',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  hero: 36,
};

export const categoryColors: Record<string, string> = {
  'Food & Dining': '#FF6B6B',
  Groceries: '#4ADE80',
  Shopping: '#60A5FA',
  Transportation: '#34D399',
  Entertainment: '#A78BFA',
  'Health & Medical': '#FFB547',
  'Utilities & Bills': '#F472B6',
  Travel: '#22D3EE',
  Education: '#818CF8',
  'Finance & Investment': '#FBBF24',
  Transfers: '#94A3B8',
  Other: '#6B7280',
};

// ---------------------------------------------------------------------------
// Multi-currency support
// ---------------------------------------------------------------------------

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export interface CurrencyConfig {
  symbol: string;
  label: string;
  grouping: 'indian' | 'western';
}

export const CURRENCY_CONFIG: Record<CurrencyCode, CurrencyConfig> = {
  INR: { symbol: '\u20B9', label: 'Indian Rupee', grouping: 'indian' },
  USD: { symbol: '$', label: 'US Dollar', grouping: 'western' },
  EUR: { symbol: '\u20AC', label: 'Euro', grouping: 'western' },
  GBP: { symbol: '\u00A3', label: 'British Pound', grouping: 'western' },
};

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP'];

/**
 * Format amount with the correct currency symbol and grouping.
 * INR uses Indian numbering (lakhs/crores), others use Western (thousands).
 */
export function formatCurrency(amount: number, currency: CurrencyCode = 'INR'): string {
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs < 1000) {
    return `${sign}${config.symbol}${abs.toFixed(2)}`;
  }

  const parts = abs.toFixed(2).split('.');
  const intPart = parts[0];
  const decimal = parts[1];

  let formatted: string;
  if (config.grouping === 'indian') {
    // Indian grouping: last 3 digits, then groups of 2
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    formatted = rest
      ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
      : lastThree;
  } else {
    // Western grouping: groups of 3
    formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  return `${sign}${config.symbol}${formatted}.${decimal}`;
}

/**
 * Format amount in INR with Indian numbering system (lakhs/crores).
 * @deprecated Use formatCurrency(amount, 'INR') instead.
 */
export function formatINR(amount: number): string {
  return formatCurrency(amount, 'INR');
}
