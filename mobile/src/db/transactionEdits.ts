/**
 * Transaction edits — non-destructive field-level overrides.
 *
 * Each row represents a single field override for a transaction.
 * The UNIQUE index on (transaction_id, field) ensures at most one
 * override per field. INSERT OR REPLACE handles upserts.
 */

import { getDb } from './index';

export interface TransactionEdit {
  id: string;
  transactionId: string;
  field: string;
  oldValue: string;
  newValue: string;
  editedAt: number;
  editSource: 'user' | 'rule';
}

export function upsertEdit(
  transactionId: string,
  field: string,
  oldValue: string,
  newValue: string,
  editSource: 'user' | 'rule' = 'user',
): void {
  const id = `${transactionId}_${field}`;
  getDb().executeSync(
    `INSERT OR REPLACE INTO transaction_edits
      (id, transaction_id, field, old_value, new_value, edited_at, edit_source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, transactionId, field, String(oldValue), String(newValue), Date.now(), editSource],
  );
}

export function getEditsForTransaction(transactionId: string): TransactionEdit[] {
  const result = getDb().executeSync(
    `SELECT * FROM transaction_edits WHERE transaction_id = ? ORDER BY edited_at DESC`,
    [transactionId],
  );
  return result.rows.map(rowToEdit);
}

export function getEditedFieldsMap(transactionId: string): Record<string, { oldValue: string; newValue: string }> {
  const edits = getEditsForTransaction(transactionId);
  const map: Record<string, { oldValue: string; newValue: string }> = {};
  for (const edit of edits) {
    map[edit.field] = { oldValue: edit.oldValue, newValue: edit.newValue };
  }
  return map;
}

export function deleteEdit(transactionId: string, field: string): void {
  getDb().executeSync(
    `DELETE FROM transaction_edits WHERE transaction_id = ? AND field = ?`,
    [transactionId, field],
  );
}

export function deleteAllEdits(transactionId: string): void {
  getDb().executeSync(
    `DELETE FROM transaction_edits WHERE transaction_id = ?`,
    [transactionId],
  );
}

export function deleteEditsByTransactionIds(ids: string[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  getDb().executeSync(
    `DELETE FROM transaction_edits WHERE transaction_id IN (${placeholders})`,
    ids,
  );
}

export function hasEdits(transactionId: string): boolean {
  const result = getDb().executeSync(
    `SELECT COUNT(*) as cnt FROM transaction_edits WHERE transaction_id = ?`,
    [transactionId],
  );
  return ((result.rows[0]?.cnt as number) ?? 0) > 0;
}

function rowToEdit(row: Record<string, any>): TransactionEdit {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    editedAt: row.edited_at,
    editSource: row.edit_source ?? 'user',
  };
}
