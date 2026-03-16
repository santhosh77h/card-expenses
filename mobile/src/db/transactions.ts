import { getDb } from './index';
import type { Transaction } from '../store';

export function insertTransaction(txn: Transaction): void {
  const db = getDb();
  db.executeSync(
    `INSERT OR REPLACE INTO transactions
      (id, date, description, amount, category, category_color, category_icon, type, transaction_type, cardId, currency, source, statementId, isImported, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', NULL, 0, strftime('%s','now'))`,
    [txn.id, txn.date, txn.description, txn.amount, txn.category, txn.category_color, txn.category_icon, txn.type, txn.transaction_type ?? 'purchase', txn.cardId ?? null, txn.currency ?? null],
  );
}

export function deleteTransaction(id: string): void {
  getDb().executeSync('DELETE FROM transactions WHERE id = ?', [id]);
}

export function deleteTransactionsByCardId(cardId: string): string[] {
  const db = getDb();
  const result = db.executeSync(
    `SELECT id FROM transactions WHERE cardId = ?`,
    [cardId],
  );
  const ids: string[] = result.rows.map((r) => r.id as string);
  if (ids.length > 0) {
    db.executeSync(`DELETE FROM transactions WHERE cardId = ?`, [cardId]);
  }
  return ids;
}

export function deleteAllManualTransactions(): string[] {
  const db = getDb();
  const result = db.executeSync(
    `SELECT id FROM transactions WHERE source = 'manual'`,
  );
  const ids: string[] = result.rows.map((r) => r.id as string);
  db.executeSync(`DELETE FROM transactions WHERE source = 'manual'`);
  return ids;
}

export function getManualTransactions(): Transaction[] {
  const db = getDb();
  const result = db.executeSync(
    `SELECT * FROM transactions WHERE source = 'manual' ORDER BY created_at DESC`,
  );
  return result.rows.map(rowToTransaction);
}

export function getVisibleTransactions(): Transaction[] {
  const db = getDb();
  const result = db.executeSync(
    `SELECT * FROM transactions WHERE source = 'manual' OR isImported = 1 ORDER BY created_at DESC`,
  );
  return result.rows.map(rowToTransaction);
}

export function insertStatementTransactions(
  statementId: string,
  cardId: string,
  txns: Transaction[],
): void {
  const db = getDb();
  for (const txn of txns) {
    db.executeSync(
      `INSERT OR REPLACE INTO transactions
        (id, date, description, amount, category, category_color, category_icon, type, transaction_type, cardId, currency, source, statementId, isImported, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'statement', ?, 0, strftime('%s','now'))`,
      [txn.id, txn.date, txn.description, txn.amount, txn.category, txn.category_color, txn.category_icon, txn.type, txn.transaction_type ?? 'purchase', cardId, txn.currency ?? null, statementId],
    );
  }
}

export function markStatementImported(statementId: string): void {
  getDb().executeSync(
    `UPDATE transactions SET isImported = 1 WHERE statementId = ?`,
    [statementId],
  );
}

export function getTransactionsByStatementId(stmtId: string): Transaction[] {
  const db = getDb();
  const result = db.executeSync(
    `SELECT * FROM transactions WHERE statementId = ? ORDER BY date DESC`,
    [stmtId],
  );
  return result.rows.map(rowToTransaction);
}

export function isStatementImported(statementId: string): boolean {
  const result = getDb().executeSync(
    `SELECT COUNT(*) as cnt FROM transactions WHERE statementId = ? AND isImported = 1`,
    [statementId],
  );
  return ((result.rows[0]?.cnt as number) ?? 0) > 0;
}

export function updateTransaction(
  id: string,
  updates: Partial<Pick<Transaction, 'date' | 'description' | 'amount' | 'category' | 'category_color' | 'category_icon' | 'type' | 'transaction_type'>>,
): void {
  const fields: string[] = [];
  const values: any[] = [];
  const allowed = ['date', 'description', 'amount', 'category', 'category_color', 'category_icon', 'type', 'transaction_type'] as const;
  for (const key of allowed) {
    if (key in updates) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  getDb().executeSync(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteTransactionsByIds(ids: string[]): void {
  if (ids.length === 0) return;
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  db.executeSync(`DELETE FROM transactions WHERE id IN (${placeholders})`, ids);
}

function rowToTransaction(row: Record<string, any>): Transaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    amount: row.amount,
    category: row.category,
    category_color: row.category_color,
    category_icon: row.category_icon,
    type: row.type,
    transaction_type: row.transaction_type ?? 'purchase',
    cardId: row.cardId ?? undefined,
    currency: row.currency ?? undefined,
  };
}
