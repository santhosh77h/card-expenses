import { getDb } from './index';
import { insertStatementTransactions, getTransactionsByStatementId } from './transactions';
import type { StatementData, StatementSummary } from '../store';
import type { CurrencyCode } from '../theme';

const EMPTY_SUMMARY: StatementSummary = {
  total_transactions: 0,
  total_debits: 0,
  total_credits: 0,
  net: 0,
  categories: {},
  statement_period: { from: null, to: null },
};

function safeParseSummary(raw: string): StatementSummary {
  try {
    return JSON.parse(raw);
  } catch {
    return EMPTY_SUMMARY;
  }
}

export function insertStatement(cardId: string, stmt: StatementData): void {
  const db = getDb();
  db.executeSync('BEGIN');
  try {
    db.executeSync(
      `INSERT OR REPLACE INTO statements (id, cardId, parsedAt, summary, csv, bankDetected, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [stmt.id, cardId, stmt.parsedAt, JSON.stringify(stmt.summary), stmt.csv, stmt.bankDetected, stmt.currency ?? null],
    );
    insertStatementTransactions(stmt.id, cardId, stmt.transactions);
    db.executeSync('COMMIT');
  } catch (e) {
    db.executeSync('ROLLBACK');
    throw e;
  }
}

export function getAllStatements(): Record<string, StatementData[]> {
  const db = getDb();
  const result = db.executeSync(`SELECT * FROM statements ORDER BY parsedAt DESC`);

  const grouped: Record<string, StatementData[]> = {};
  for (const row of result.rows) {
    const cardId = row.cardId as string;
    if (!grouped[cardId]) grouped[cardId] = [];

    const transactions = getTransactionsByStatementId(row.id as string);

    grouped[cardId].push({
      id: row.id as string,
      cardId,
      parsedAt: row.parsedAt as string,
      transactions,
      summary: safeParseSummary(row.summary as string),
      csv: row.csv as string,
      bankDetected: row.bankDetected as string,
      currency: (row.currency as CurrencyCode | null) ?? undefined,
    });
  }
  return grouped;
}

export function getStatementCountSince(sinceIso: string): number {
  const db = getDb();
  const result = db.executeSync(
    `SELECT COUNT(*) as cnt FROM statements WHERE parsedAt >= ?`,
    [sinceIso],
  );
  return (result.rows[0]?.cnt as number) ?? 0;
}

export function deleteStatementsByCardId(cardId: string): void {
  getDb().executeSync(`DELETE FROM statements WHERE cardId = ?`, [cardId]);
}

export function deleteStatementById(statementId: string): void {
  getDb().executeSync(`DELETE FROM statements WHERE id = ?`, [statementId]);
}
