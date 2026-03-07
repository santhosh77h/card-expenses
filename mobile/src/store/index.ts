import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CurrencyCode } from '../theme';
import * as dbTxns from '../db/transactions';
import * as dbStmts from '../db/statements';
import * as dbEnrich from '../db/enrichments';
import * as dbUsage from '../db/monthlyUsage';

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
  currency?: CurrencyCode;
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
  currency?: CurrencyCode;
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
  currency?: CurrencyCode;
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
  currency?: CurrencyCode;
}

// ---------------------------------------------------------------------------
// Transaction Enrichments
// ---------------------------------------------------------------------------

export interface TransactionEnrichment {
  notes?: string;
  flagged?: boolean;
  receiptUri?: string;
  updatedAt?: string;
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
  enrichments: Record<string, TransactionEnrichment>;

  addCard: (card: CreditCard) => void;
  removeCard: (id: string) => void;
  updateCard: (id: string, updates: Partial<CreditCard>) => void;
  setActiveCard: (id: string | null) => void;
  addStatement: (cardId: string, statement: StatementData) => void;
  clearStatements: (cardId: string) => void;
  addTransaction: (txn: Transaction) => void;
  importStatementTransactions: (statementId: string) => void;
  removeTransaction: (id: string) => void;
  clearManualTransactions: () => void;
  _hydrateSqlite: () => void;
  addMonthlyUsage: (usage: MonthlyUsage) => void;
  updateEnrichment: (txnId: string, patch: Partial<TransactionEnrichment>) => void;
  toggleFlag: (txnId: string) => void;
  removeEnrichment: (txnId: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      cards: [],
      statements: {},
      activeCardId: null,
      manualTransactions: [],
      monthlyUsage: [],
      enrichments: {},

      addCard: (card) =>
        set((state) => ({
          cards: [...state.cards, card],
          activeCardId: state.activeCardId ?? card.id,
        })),

      removeCard: (id) =>
        set((state) => {
          dbStmts.deleteStatementsByCardId(id);
          dbUsage.deleteMonthlyUsageByCardId(id);
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

      addStatement: (cardId, statement) => {
        dbStmts.insertStatement(cardId, statement);
        set((state) => ({
          statements: {
            ...state.statements,
            [cardId]: [...(state.statements[cardId] || []), statement],
          },
        }));
      },

      clearStatements: (cardId) =>
        set((state) => {
          const stmts = state.statements[cardId] || [];
          const txnIds = stmts.flatMap((s) => s.transactions.map((t) => t.id));
          dbStmts.deleteStatementsByCardId(cardId);
          dbEnrich.deleteEnrichments(txnIds);
          const enrichments = { ...state.enrichments };
          for (const id of txnIds) delete enrichments[id];
          return {
            statements: { ...state.statements, [cardId]: [] },
            enrichments,
            manualTransactions: dbTxns.getVisibleTransactions(),
          };
        }),

      addTransaction: (txn) => {
        dbTxns.insertTransaction(txn);
        set((state) => ({
          manualTransactions: [txn, ...state.manualTransactions],
        }));
      },

      importStatementTransactions: (statementId) => {
        dbTxns.markStatementImported(statementId);
        set({
          manualTransactions: dbTxns.getVisibleTransactions(),
        });
      },

      removeTransaction: (id) => {
        dbTxns.deleteTransaction(id);
        dbEnrich.deleteEnrichment(id);
        set((state) => {
          const enrichments = { ...state.enrichments };
          delete enrichments[id];
          return {
            manualTransactions: state.manualTransactions.filter((t) => t.id !== id),
            enrichments,
          };
        });
      },

      clearManualTransactions: () => {
        const ids = dbTxns.deleteAllManualTransactions();
        dbEnrich.deleteEnrichments(ids);
        set((state) => {
          const enrichments = { ...state.enrichments };
          for (const id of ids) delete enrichments[id];
          return { manualTransactions: [], enrichments };
        });
      },

      addMonthlyUsage: (usage) => {
        dbUsage.upsertMonthlyUsage(usage);
        set((state) => ({
          monthlyUsage: [
            ...state.monthlyUsage.filter(
              (u) => !(u.cardId === usage.cardId && u.month === usage.month)
            ),
            usage,
          ],
        }));
      },

      updateEnrichment: (txnId, patch) =>
        set((state) => {
          const merged = {
            ...state.enrichments[txnId],
            ...patch,
            updatedAt: new Date().toISOString(),
          };
          dbEnrich.upsertEnrichment(txnId, merged);
          return {
            enrichments: {
              ...state.enrichments,
              [txnId]: merged,
            },
          };
        }),

      toggleFlag: (txnId) =>
        set((state) => {
          const updated = {
            ...state.enrichments[txnId],
            flagged: !state.enrichments[txnId]?.flagged,
            updatedAt: new Date().toISOString(),
          };
          dbEnrich.upsertEnrichment(txnId, updated);
          return {
            enrichments: {
              ...state.enrichments,
              [txnId]: updated,
            },
          };
        }),

      removeEnrichment: (txnId) => {
        dbEnrich.deleteEnrichment(txnId);
        set((state) => {
          const enrichments = { ...state.enrichments };
          delete enrichments[txnId];
          return { enrichments };
        });
      },

      _hydrateSqlite: () => set({
        manualTransactions: dbTxns.getVisibleTransactions(),
        statements: dbStmts.getAllStatements(),
        enrichments: dbEnrich.getAllEnrichments(),
        monthlyUsage: dbUsage.getAllMonthlyUsage(),
      }),
    }),
    {
      name: 'cardlytics-storage',
      storage: createJSONStorage(() => asyncStorageAdapter),
      partialize: (state) => ({
        cards: state.cards,
        activeCardId: state.activeCardId,
      }),
    }
  )
);
