import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// AsyncStorage adapter (works in Expo Go without native builds)
// ---------------------------------------------------------------------------

const asyncStorageAdapter: StateStorage = {
  getItem: async (name: string) => {
    return (await AsyncStorage.getItem(name)) ?? null;
  },
  setItem: async (name: string, value: string) => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string) => {
    await AsyncStorage.removeItem(name);
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditCard {
  id: string;
  nickname: string;
  last4: string;
  issuer: string;
  network: string;
  creditLimit: number;
  billingCycle: string;
  color: string;
  totalAmountDue?: number;
  minimumAmountDue?: number;
  paymentDueDate?: string;
  autoCreated?: boolean;
}

export interface MonthlyUsage {
  cardId: string;
  month: string;        // "YYYY-MM" derived from statement_period.to
  totalDebits: number;
  totalCredits: number;
  net: number;
  statementId: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  category_color: string;
  category_icon: string;
  type: 'debit' | 'credit';
  cardId?: string;
}

export interface CategorySummary {
  total: number;
  count: number;
}

export interface StatementPeriod {
  from: string | null;
  to: string | null;
}

export interface StatementSummary {
  total_transactions: number;
  total_debits: number;
  total_credits: number;
  net: number;
  categories: Record<string, CategorySummary>;
  statement_period: StatementPeriod;
}

export interface StatementData {
  id: string;
  cardId: string;
  parsedAt: string;
  transactions: Transaction[];
  summary: StatementSummary;
  csv: string;
  bankDetected: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AppState {
  cards: CreditCard[];
  statements: Record<string, StatementData[]>;
  activeCardId: string | null;
  manualTransactions: Transaction[];
  monthlyUsage: MonthlyUsage[];

  addCard: (card: CreditCard) => void;
  removeCard: (id: string) => void;
  updateCard: (id: string, updates: Partial<CreditCard>) => void;
  setActiveCard: (id: string | null) => void;
  addStatement: (cardId: string, statement: StatementData) => void;
  clearStatements: (cardId: string) => void;
  addTransaction: (txn: Transaction) => void;
  addTransactions: (txns: Transaction[]) => void;
  removeTransaction: (id: string) => void;
  clearManualTransactions: () => void;
  addMonthlyUsage: (usage: MonthlyUsage) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      cards: [],
      statements: {},
      activeCardId: null,
      manualTransactions: [],
      monthlyUsage: [],

      addCard: (card) =>
        set((state) => ({
          cards: [...state.cards, card],
          activeCardId: state.activeCardId ?? card.id,
        })),

      removeCard: (id) =>
        set((state) => {
          const cards = state.cards.filter((c) => c.id !== id);
          const statements = { ...state.statements };
          delete statements[id];
          return {
            cards,
            statements,
            activeCardId:
              state.activeCardId === id
                ? cards[0]?.id ?? null
                : state.activeCardId,
            monthlyUsage: state.monthlyUsage.filter((u) => u.cardId !== id),
          };
        }),

      updateCard: (id, updates) =>
        set((state) => ({
          cards: state.cards.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),

      setActiveCard: (id) => set({ activeCardId: id }),

      addStatement: (cardId, statement) =>
        set((state) => ({
          statements: {
            ...state.statements,
            [cardId]: [...(state.statements[cardId] || []), statement],
          },
        })),

      clearStatements: (cardId) =>
        set((state) => ({
          statements: {
            ...state.statements,
            [cardId]: [],
          },
        })),

      addTransaction: (txn) =>
        set((state) => ({
          manualTransactions: [txn, ...state.manualTransactions],
        })),

      addTransactions: (txns) =>
        set((state) => ({
          manualTransactions: [...txns, ...state.manualTransactions],
        })),

      removeTransaction: (id) =>
        set((state) => ({
          manualTransactions: state.manualTransactions.filter((t) => t.id !== id),
        })),

      clearManualTransactions: () =>
        set({ manualTransactions: [] }),

      addMonthlyUsage: (usage) =>
        set((state) => ({
          monthlyUsage: [
            ...state.monthlyUsage.filter(
              (u) => !(u.cardId === usage.cardId && u.month === usage.month)
            ),
            usage,
          ],
        })),
    }),
    {
      name: 'cardlytics-storage',
      storage: createJSONStorage(() => asyncStorageAdapter),
    }
  )
);
