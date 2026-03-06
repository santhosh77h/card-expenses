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

/**
 * Format amount in INR with Indian numbering system (lakhs/crores).
 */
export function formatINR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs < 1000) {
    return `${sign}\u20B9${abs.toFixed(2)}`;
  }

  const parts = abs.toFixed(2).split('.');
  let intPart = parts[0];
  const decimal = parts[1];

  // Indian grouping: last 3 digits, then groups of 2
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const formatted = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
    : lastThree;

  return `${sign}\u20B9${formatted}.${decimal}`;
}
