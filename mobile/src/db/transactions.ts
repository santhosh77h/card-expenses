import { getDb } from './index';
import type { Transaction } from '../store';
import { upsertEdit } from './transactionEdits';

// ---------------------------------------------------------------------------
// Merge query — resolves transaction_edits on top of immutable transactions
// ---------------------------------------------------------------------------

const MERGE_SELECT = `
  SELECT
    t.id, t.cardId, t.currency, t.source, t.statementId, t.isImported,
    t.created_at, t.transaction_type,
    COALESCE(e_date.new_value, t.date) AS date,
    COALESCE(e_desc.new_value, t.description) AS description,
    CAST(COALESCE(e_amt.new_value, t.amount) AS REAL) AS amount,
    COALESCE(e_cat.new_value, t.category) AS category,
    COALESCE(e_cc.new_value, t.category_color) AS category_color,
    COALESCE(e_ci.new_value, t.category_icon) AS category_icon,
    COALESCE(e_type.new_value, t.type) AS type,
    CASE WHEN EXISTS (
      SELECT 1 FROM transaction_edits WHERE transaction_id = t.id
    ) THEN 1 ELSE 0 END AS is_edited
  FROM transactions t
  LEFT JOIN transaction_edits e_date ON e_date.transaction_id = t.id AND e_date.field = 'date'
  LEFT JOIN transaction_edits e_desc ON e_desc.transaction_id = t.id AND e_desc.field = 'description'
  LEFT JOIN transaction_edits e_amt  ON e_amt.transaction_id = t.id  AND e_amt.field = 'amount'
  LEFT JOIN transaction_edits e_cat  ON e_cat.transaction_id = t.id  AND e_cat.field = 'category'
  LEFT JOIN transaction_edits e_cc   ON e_cc.transaction_id = t.id   AND e_cc.field = 'category_color'
  LEFT JOIN transaction_edits e_ci   ON e_ci.transaction_id = t.id   AND e_ci.field = 'category_icon'
  LEFT JOIN transaction_edits e_type ON e_type.transaction_id = t.id AND e_type.field = 'type'
`;

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function insertTransaction(txn: Transaction): void {
  const db = getDb();
  db.executeSync(
    `INSERT OR REPLACE INTO transactions
      (id, date, description, amount, category, category_color, category_icon, type, transaction_type, cardId, currency, source, statementId, isImported, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', NULL, 0, strftime('%s','now'))`,
    [txn.id, txn.date, txn.description, txn.amount, txn.category, txn.category_color, txn.category_icon, txn.type, txn.transaction_type ?? 'purchase', txn.cardId ?? null, txn.currency ?? null],
  );
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

// ---------------------------------------------------------------------------
// Read (all reads go through the merge view)
// ---------------------------------------------------------------------------

export function getManualTransactions(): Transaction[] {
  const result = getDb().executeSync(
    `${MERGE_SELECT} WHERE t.source = 'manual' ORDER BY t.created_at DESC`,
  );
  return result.rows.map(rowToTransaction);
}

export function getVisibleTransactions(): Transaction[] {
  const result = getDb().executeSync(
    `${MERGE_SELECT} WHERE t.source = 'manual' OR t.isImported = 1 ORDER BY t.created_at DESC`,
  );
  return result.rows.map(rowToTransaction);
}

export function getTransactionsByStatementId(stmtId: string): Transaction[] {
  const result = getDb().executeSync(
    `${MERGE_SELECT} WHERE t.statementId = ? ORDER BY date DESC`,
    [stmtId],
  );
  return result.rows.map(rowToTransaction);
}

/**
 * Get the original (unmerged) transaction — for showing "Original: ..." in edit mode.
 */
export function getOriginalTransaction(id: string): Transaction | null {
  const result = getDb().executeSync(
    `SELECT * FROM transactions WHERE id = ?`,
    [id],
  );
  if (result.rows.length === 0) return null;
  return rowToTransaction(result.rows[0]);
}

export function getTransactionsByMerchant(description: string, excludeId: string, limit: number = 10): Transaction[] {
  const result = getDb().executeSync(
    `${MERGE_SELECT} WHERE LOWER(TRIM(t.description)) = LOWER(TRIM(?)) AND t.id != ? ORDER BY date DESC LIMIT ?`,
    [description, excludeId, limit],
  );
  return result.rows.map(rowToTransaction);
}

export function getTotalTransactionCount(): number {
  const result = getDb().executeSync(`SELECT COUNT(*) as cnt FROM transactions`);
  return (result.rows[0]?.cnt as number) ?? 0;
}

export function isStatementImported(statementId: string): boolean {
  const result = getDb().executeSync(
    `SELECT COUNT(*) as cnt FROM transactions WHERE statementId = ? AND isImported = 1`,
    [statementId],
  );
  return ((result.rows[0]?.cnt as number) ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Update — writes to transaction_edits, not transactions
// ---------------------------------------------------------------------------

const EDITABLE_FIELDS = ['date', 'description', 'amount', 'category', 'category_color', 'category_icon', 'type'] as const;

export function updateTransaction(
  id: string,
  updates: Partial<Pick<Transaction, 'date' | 'description' | 'amount' | 'category' | 'category_color' | 'category_icon' | 'type' | 'transaction_type'>>,
): void {
  // Read original values from the immutable transactions table
  const original = getOriginalTransaction(id);
  if (!original) return;

  for (const field of EDITABLE_FIELDS) {
    if (!(field in updates)) continue;
    const newVal = updates[field as keyof typeof updates];
    if (newVal === undefined) continue;

    const originalVal = original[field as keyof Transaction];
    const newStr = String(newVal);
    const oldStr = String(originalVal);

    // Only create an edit if the value actually differs from the original
    if (newStr !== oldStr) {
      upsertEdit(id, field, oldStr, newStr);
    }
  }

  // transaction_type is stored directly (not an override field — it's metadata)
  if ('transaction_type' in updates && updates.transaction_type !== undefined) {
    getDb().executeSync(
      `UPDATE transactions SET transaction_type = ? WHERE id = ?`,
      [updates.transaction_type, id],
    );
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export function deleteTransaction(id: string): void {
  getDb().executeSync('DELETE FROM transactions WHERE id = ?', [id]);
  // CASCADE handles transaction_edits cleanup
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

export function deleteTransactionsByIds(ids: string[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  getDb().executeSync(`DELETE FROM transactions WHERE id IN (${placeholders})`, ids);
}

export function markStatementImported(statementId: string): void {
  getDb().executeSync(
    `UPDATE transactions SET isImported = 1 WHERE statementId = ?`,
    [statementId],
  );
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

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
    isEdited: row.is_edited === 1,
  };
}
