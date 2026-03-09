import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import type { CurrencyCode } from '../theme';
import * as dbTxns from '../db/transactions';
import * as dbStmts from '../db/statements';
import * as dbEnrich from '../db/enrichments';
import * as dbUsage from '../db/monthlyUsage';
import * as dbFileHashes from '../db/fileHashes';
import { generateCSV } from '../utils/api';

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
// Recompute summary from transactions
// ---------------------------------------------------------------------------

export function recomputeSummary(
  transactions: Transaction[],
  existingPeriod?: StatementPeriod,
): StatementSummary {
  const totalDebits = transactions
    .filter((t) => t.type === 'debit')
    .reduce((s, t) => s + t.amount, 0);
  const totalCredits = transactions
    .filter((t) => t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);

  const categories: Record<string, CategorySummary> = {};
  for (const t of transactions) {
    if (!categories[t.category]) categories[t.category] = { total: 0, count: 0 };
    categories[t.category].total += t.amount;
    categories[t.category].count += 1;
  }

  const dates = transactions.map((t) => t.date).filter(Boolean).sort();
  const statement_period: StatementPeriod = existingPeriod ?? {
    from: dates[0] || null,
    to: dates[dates.length - 1] || null,
  };

  return {
    total_transactions: transactions.length,
    total_debits: Math.round(totalDebits * 100) / 100,
    total_credits: Math.round(totalCredits * 100) / 100,
    net: Math.round((totalDebits - totalCredits) * 100) / 100,
    categories,
    statement_period,
  };
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
  isPremium: boolean;
  uploadsThisMonth: number;

  addCard: (card: CreditCard) => void;
  removeCard: (id: string) => void;
  updateCard: (id: string, updates: Partial<CreditCard>) => void;
  setActiveCard: (id: string | null) => void;
  addStatement: (cardId: string, statement: StatementData) => void;
  removeStatement: (cardId: string, statementId: string) => void;
  clearStatements: (cardId: string) => void;
  addTransaction: (txn: Transaction) => void;
  importStatementTransactions: (statementId: string) => void;
  removeTransaction: (id: string) => void;
  clearManualTransactions: () => void;
  _hydrateSqlite: () => void;
  _setIsPremium: (value: boolean) => void;
  _refreshUploadCount: () => void;
  addMonthlyUsage: (usage: MonthlyUsage) => void;
  updateEnrichment: (txnId: string, patch: Partial<TransactionEnrichment>) => void;
  toggleFlag: (txnId: string) => void;
  removeEnrichment: (txnId: string) => void;
  updateStatementTransaction: (
    cardId: string,
    statementId: string,
    txnId: string,
    updates: Partial<Pick<Transaction, 'date' | 'description' | 'amount' | 'category' | 'category_color' | 'category_icon' | 'type'>>,
  ) => void;
  updateStatementCardFields: (
    cardId: string,
    statementId: string,
    cardUpdates?: Partial<Pick<CreditCard, 'totalAmountDue' | 'minimumAmountDue' | 'paymentDueDate'>>,
    periodUpdates?: Partial<StatementPeriod>,
  ) => void;
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
      isPremium: false,
      uploadsThisMonth: 0,

      addCard: (card) =>
        set((state) => ({
          cards: [...state.cards, card],
          activeCardId: state.activeCardId ?? card.id,
        })),

      removeCard: (id) =>
        set((state) => {
          try {
            dbFileHashes.deleteFileHashesByCardId(id);
            dbStmts.deleteStatementsByCardId(id);
            dbUsage.deleteMonthlyUsageByCardId(id);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to remove card data.');
            return {};
          }
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
        try {
          dbStmts.insertStatement(cardId, statement);
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Failed to save statement.');
          return;
        }
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const uploadsThisMonth = dbStmts.getStatementCountSince(firstOfMonth);
        set((state) => ({
          statements: {
            ...state.statements,
            [cardId]: [...(state.statements[cardId] || []), statement],
          },
          uploadsThisMonth,
        }));
      },

      removeStatement: (cardId, statementId) =>
        set((state) => {
          const stmt = (state.statements[cardId] || []).find((s) => s.id === statementId);
          const txnIds = stmt ? stmt.transactions.map((t) => t.id) : [];
          try {
            dbFileHashes.deleteFileHashesByStatementId(statementId);
            dbUsage.deleteMonthlyUsageByStatementId(statementId);
            dbEnrich.deleteEnrichments(txnIds);
            dbStmts.deleteStatementById(statementId);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to remove statement.');
            return {};
          }
          const enrichments = { ...state.enrichments };
          for (const id of txnIds) delete enrichments[id];
          return {
            statements: {
              ...state.statements,
              [cardId]: (state.statements[cardId] || []).filter((s) => s.id !== statementId),
            },
            monthlyUsage: state.monthlyUsage.filter((u) => u.statementId !== statementId),
            enrichments,
            manualTransactions: dbTxns.getVisibleTransactions(),
          };
        }),

      clearStatements: (cardId) =>
        set((state) => {
          const stmts = state.statements[cardId] || [];
          const txnIds = stmts.flatMap((s) => s.transactions.map((t) => t.id));
          try {
            dbStmts.deleteStatementsByCardId(cardId);
            dbEnrich.deleteEnrichments(txnIds);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to clear statements.');
            return {};
          }
          const enrichments = { ...state.enrichments };
          for (const id of txnIds) delete enrichments[id];
          return {
            statements: { ...state.statements, [cardId]: [] },
            enrichments,
            manualTransactions: dbTxns.getVisibleTransactions(),
          };
        }),

      addTransaction: (txn) => {
        try {
          dbTxns.insertTransaction(txn);
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Failed to save transaction.');
          return;
        }
        set((state) => ({
          manualTransactions: [txn, ...state.manualTransactions],
        }));
      },

      importStatementTransactions: (statementId) => {
        try {
          dbTxns.markStatementImported(statementId);
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Failed to import transactions.');
          return;
        }
        set({
          manualTransactions: dbTxns.getVisibleTransactions(),
        });
      },

      removeTransaction: (id) => {
        try {
          dbTxns.deleteTransaction(id);
          dbEnrich.deleteEnrichment(id);
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Failed to remove transaction.');
          return;
        }
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
        let ids: string[];
        try {
          ids = dbTxns.deleteAllManualTransactions();
          dbEnrich.deleteEnrichments(ids);
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Failed to clear transactions.');
          return;
        }
        set((state) => {
          const enrichments = { ...state.enrichments };
          for (const id of ids) delete enrichments[id];
          return { manualTransactions: [], enrichments };
        });
      },

      addMonthlyUsage: (usage) => {
        try {
          dbUsage.upsertMonthlyUsage(usage);
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Failed to save monthly usage.');
          return;
        }
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
          try {
            dbEnrich.upsertEnrichment(txnId, merged);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to update enrichment.');
            return {};
          }
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
          try {
            dbEnrich.upsertEnrichment(txnId, updated);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to toggle flag.');
            return {};
          }
          return {
            enrichments: {
              ...state.enrichments,
              [txnId]: updated,
            },
          };
        }),

      removeEnrichment: (txnId) => {
        try {
          dbEnrich.deleteEnrichment(txnId);
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Failed to remove enrichment.');
          return;
        }
        set((state) => {
          const enrichments = { ...state.enrichments };
          delete enrichments[txnId];
          return { enrichments };
        });
      },

      updateStatementTransaction: (cardId, statementId, txnId, updates) => {
        try {
          dbTxns.updateTransaction(txnId, updates);
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Failed to update transaction.');
          return;
        }

        set((state) => {
          const cardStmts = (state.statements[cardId] || []).map((stmt) => {
            if (stmt.id !== statementId) return stmt;

            const updatedTransactions = stmt.transactions.map((t) =>
              t.id === txnId ? { ...t, ...updates } : t,
            );
            const newSummary = recomputeSummary(updatedTransactions, stmt.summary.statement_period);
            const newCsv = generateCSV(updatedTransactions);

            try {
              dbStmts.updateStatementSummary(statementId, newSummary);
              dbStmts.updateStatementCsv(statementId, newCsv);
            } catch (e: any) {
              console.error('Failed to persist summary/csv:', e);
            }

            // Update monthly usage
            const month = newSummary.statement_period.to?.slice(0, 7);
            if (month) {
              try {
                dbUsage.upsertMonthlyUsage({
                  cardId,
                  month,
                  totalDebits: newSummary.total_debits,
                  totalCredits: newSummary.total_credits,
                  net: newSummary.net,
                  statementId,
                  currency: stmt.currency,
                });
              } catch (e: any) {
                console.error('Failed to update monthly usage:', e);
              }
            }

            return { ...stmt, transactions: updatedTransactions, summary: newSummary, csv: newCsv };
          });

          const manualTransactions = dbTxns.getVisibleTransactions();

          // Update monthly usage in state
          const updatedStmt = cardStmts.find((s) => s.id === statementId);
          let monthlyUsage = state.monthlyUsage;
          if (updatedStmt) {
            const month = updatedStmt.summary.statement_period.to?.slice(0, 7);
            if (month) {
              const newUsage: MonthlyUsage = {
                cardId,
                month,
                totalDebits: updatedStmt.summary.total_debits,
                totalCredits: updatedStmt.summary.total_credits,
                net: updatedStmt.summary.net,
                statementId,
                currency: updatedStmt.currency,
              };
              monthlyUsage = [
                ...state.monthlyUsage.filter((u) => !(u.cardId === cardId && u.month === month)),
                newUsage,
              ];
            }
          }

          return {
            statements: { ...state.statements, [cardId]: cardStmts },
            manualTransactions,
            monthlyUsage,
          };
        });
      },

      updateStatementCardFields: (cardId, statementId, cardUpdates, periodUpdates) => {
        set((state) => {
          let cards = state.cards;
          if (cardUpdates && Object.keys(cardUpdates).length > 0) {
            cards = state.cards.map((c) => (c.id === cardId ? { ...c, ...cardUpdates } : c));
          }

          let statementsForCard = state.statements[cardId] || [];
          if (periodUpdates) {
            statementsForCard = statementsForCard.map((stmt) => {
              if (stmt.id !== statementId) return stmt;
              const newPeriod: StatementPeriod = {
                from: periodUpdates.from ?? stmt.summary.statement_period.from,
                to: periodUpdates.to ?? stmt.summary.statement_period.to,
              };
              const newSummary = { ...stmt.summary, statement_period: newPeriod };
              try {
                dbStmts.updateStatementSummary(statementId, newSummary);
              } catch (e: any) {
                console.error('Failed to persist period update:', e);
              }
              return { ...stmt, summary: newSummary };
            });
          }

          return {
            cards,
            statements: { ...state.statements, [cardId]: statementsForCard },
          };
        });
      },

      _hydrateSqlite: () => {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        let manualTransactions: Transaction[] = [];
        try { manualTransactions = dbTxns.getVisibleTransactions(); } catch (e) { console.error('Hydrate transactions failed:', e); }

        let statements: Record<string, StatementData[]> = {};
        try { statements = dbStmts.getAllStatements(); } catch (e) { console.error('Hydrate statements failed:', e); }

        let enrichments: Record<string, TransactionEnrichment> = {};
        try { enrichments = dbEnrich.getAllEnrichments(); } catch (e) { console.error('Hydrate enrichments failed:', e); }

        let monthlyUsage: MonthlyUsage[] = [];
        try { monthlyUsage = dbUsage.getAllMonthlyUsage(); } catch (e) { console.error('Hydrate monthlyUsage failed:', e); }

        let uploadsThisMonth = 0;
        try { uploadsThisMonth = dbStmts.getStatementCountSince(firstOfMonth); } catch (e) { console.error('Hydrate uploadCount failed:', e); }

        set({ manualTransactions, statements, enrichments, monthlyUsage, uploadsThisMonth });
      },

      _setIsPremium: (value) => set({ isPremium: value }),

      _refreshUploadCount: () => {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        set({ uploadsThisMonth: dbStmts.getStatementCountSince(firstOfMonth) });
      },
    }),
    {
      name: 'vector-storage',
      storage: createJSONStorage(() => asyncStorageAdapter),
      partialize: (state) => ({
        cards: state.cards,
        activeCardId: state.activeCardId,
      }),
    }
  )
);
