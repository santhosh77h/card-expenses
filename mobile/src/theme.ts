// ---------------------------------------------------------------------------
// Theme mode types
// ---------------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark' | 'system';

// ---------------------------------------------------------------------------
// Color palettes
// ---------------------------------------------------------------------------

export const darkColors = {
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
  textOnAccent: '#0A0E1A',
};

export const lightColors: ThemeColors = {
  background: '#F8F9FC',
  surface: '#FFFFFF',
  surfaceElevated: '#F0F2F5',
  accent: '#00B880',
  debit: '#DC2626',
  credit: '#059669',
  warning: '#D97706',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  tabBarBg: '#FFFFFF',
  tabBarActive: '#00B880',
  tabBarInactive: '#9CA3AF',
  textOnAccent: '#FFFFFF',
};

export type ThemeColors = typeof darkColors;

/** @deprecated Use useColors() hook instead */
export const colors = darkColors;

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
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 24,
  hero: 32,
};

export const typography = {
  displayLarge:  { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  headlineLarge: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const },
  titleLarge:    { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  titleMedium:   { fontSize: 16, lineHeight: 22, fontWeight: '500' as const },
  titleSmall:    { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  bodyLarge:     { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyMedium:    { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  bodySmall:     { fontSize: 12, lineHeight: 18, fontWeight: '400' as const },
  labelLarge:    { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  labelMedium:   { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  labelSmall:    { fontSize: 11, lineHeight: 16, fontWeight: '500' as const },
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

// ---------------------------------------------------------------------------
// Date formatting (locale-aware based on Stage 1 intelligence)
// ---------------------------------------------------------------------------

export type DateFormat = 'DMY' | 'MDY' | 'YMD';

/**
 * Format an ISO date string (YYYY-MM-DD) into locale-appropriate display format.
 * DMY → 15/03/2024 (India, UK, AU, EU)
 * MDY → 03/15/2024 (US, Canada)
 * YMD → 2024-03-15 (ISO, rare in statements)
 */
export function formatDate(isoDate: string, dateFormat: DateFormat = 'DMY'): string {
  if (!isoDate || isoDate.length < 10) return isoDate || '';
  const [year, month, day] = isoDate.substring(0, 10).split('-');
  switch (dateFormat) {
    case 'MDY': return `${month}/${day}/${year}`;
    case 'YMD': return `${year}-${month}-${day}`;
    case 'DMY':
    default: return `${day}/${month}/${year}`;
  }
}

/**
 * Derive date format from currency when explicit format is unavailable.
 */
export function dateFormatForCurrency(currency: CurrencyCode): DateFormat {
  return currency === 'USD' ? 'MDY' : 'DMY';
}

// ---------------------------------------------------------------------------
// Transaction type metadata - label + icon for each transaction_type value
// ---------------------------------------------------------------------------

export const TRANSACTION_TYPE_META: Record<string, { label: string; icon: string }> = {
  purchase:   { label: 'Purchase',   icon: 'shopping-bag' },
  payment:    { label: 'Payment',    icon: 'credit-card' },
  refund:     { label: 'Refund',     icon: 'rotate-ccw' },
  reversal:   { label: 'Reversal',   icon: 'arrow-left-right' },
  cashback:   { label: 'Cashback',   icon: 'gift' },
  emi:        { label: 'EMI',        icon: 'calendar' },
  fee:        { label: 'Fee',        icon: 'file-text' },
  tax:        { label: 'Tax',        icon: 'percent' },
  interest:   { label: 'Interest',   icon: 'trending-up' },
  adjustment: { label: 'Adjustment', icon: 'sliders' },
  transfer:   { label: 'Transfer',   icon: 'repeat' },
};

// ---------------------------------------------------------------------------
// Chart palette - 10 high-contrast colors for multi-series charts on dark bg
// ---------------------------------------------------------------------------

export const chartPalette = [
  '#5B8DEF', // blue
  '#FF6B8A', // rose
  '#36D7B7', // teal
  '#A78BFA', // purple
  '#FB923C', // orange
  '#22D3EE', // cyan
  '#FBBF24', // amber
  '#F472B6', // hot pink
  '#34D399', // emerald
  '#C084FC', // violet
];
