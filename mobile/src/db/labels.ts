import { getDb } from './index';

export interface Label {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Label CRUD
// ---------------------------------------------------------------------------

export function insertLabel(label: Label): void {
  getDb().executeSync(
    `INSERT INTO labels (id, name, color, icon, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [label.id, label.name, label.color, label.icon, label.createdAt],
  );
}

export function updateLabelFields(id: string, updates: Partial<Pick<Label, 'name' | 'color' | 'icon'>>): void {
  const fields: string[] = [];
  const values: (string)[] = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
  if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon); }
  if (fields.length === 0) return;
  values.push(id);
  getDb().executeSync(
    `UPDATE labels SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function getAllLabels(): Label[] {
  const result = getDb().executeSync(`SELECT * FROM labels ORDER BY createdAt DESC`);
  return result.rows.map(rowToLabel);
}

export function deleteLabel(labelId: string): void {
  // CASCADE handles transaction_labels cleanup
  getDb().executeSync(`DELETE FROM labels WHERE id = ?`, [labelId]);
}

// ---------------------------------------------------------------------------
// Transaction ↔ Label junction
// ---------------------------------------------------------------------------

export function addLabelToTransaction(transactionId: string, labelId: string): void {
  getDb().executeSync(
    `INSERT OR IGNORE INTO transaction_labels (transactionId, labelId, addedAt)
     VALUES (?, ?, ?)`,
    [transactionId, labelId, new Date().toISOString()],
  );
}

export function removeLabelFromTransaction(transactionId: string, labelId: string): void {
  getDb().executeSync(
    `DELETE FROM transaction_labels WHERE transactionId = ? AND labelId = ?`,
    [transactionId, labelId],
  );
}

export function getLabelsForTransaction(transactionId: string): Label[] {
  const result = getDb().executeSync(
    `SELECT l.* FROM labels l
     INNER JOIN transaction_labels tl ON l.id = tl.labelId
     WHERE tl.transactionId = ?`,
    [transactionId],
  );
  return result.rows.map(rowToLabel);
}

/** Returns txnId → labelId[] map for all transactions that have labels. */
export function getAllTransactionLabels(): Record<string, string[]> {
  const result = getDb().executeSync(
    `SELECT transactionId, labelId FROM transaction_labels`,
  );
  const map: Record<string, string[]> = {};
  for (const row of result.rows) {
    const txnId = row.transactionId as string;
    if (!map[txnId]) map[txnId] = [];
    map[txnId].push(row.labelId as string);
  }
  return map;
}

/** Returns all transaction IDs that have a given label. */
export function getTransactionIdsForLabel(labelId: string): string[] {
  const result = getDb().executeSync(
    `SELECT transactionId FROM transaction_labels WHERE labelId = ?`,
    [labelId],
  );
  return result.rows.map((r) => r.transactionId as string);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToLabel(row: Record<string, unknown>): Label {
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    icon: row.icon as string,
    createdAt: row.createdAt as string,
  };
}
