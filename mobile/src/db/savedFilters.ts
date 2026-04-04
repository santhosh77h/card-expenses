import { getDb } from './index';

export interface SavedMerchantFilter {
  id: string;
  name: string;
  merchants: string[];
  createdAt: string;
  updatedAt: string;
}

export function insertFilter(filter: SavedMerchantFilter): void {
  getDb().executeSync(
    `INSERT INTO saved_merchant_filters (id, name, merchants, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)`,
    [filter.id, filter.name, JSON.stringify(filter.merchants), filter.createdAt, filter.updatedAt],
  );
}

export function getAllFilters(): SavedMerchantFilter[] {
  const result = getDb().executeSync(
    `SELECT * FROM saved_merchant_filters ORDER BY updatedAt DESC`,
  );
  return result.rows.map(rowToFilter);
}

export function deleteFilter(id: string): void {
  getDb().executeSync(`DELETE FROM saved_merchant_filters WHERE id = ?`, [id]);
}

export function updateFilter(id: string, updates: Partial<Pick<SavedMerchantFilter, 'name' | 'merchants'>>): void {
  const fields: string[] = [];
  const values: string[] = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.merchants !== undefined) { fields.push('merchants = ?'); values.push(JSON.stringify(updates.merchants)); }
  if (fields.length === 0) return;
  fields.push('updatedAt = ?');
  values.push(new Date().toISOString());
  values.push(id);
  getDb().executeSync(
    `UPDATE saved_merchant_filters SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

function rowToFilter(row: Record<string, unknown>): SavedMerchantFilter {
  return {
    id: row.id as string,
    name: row.name as string,
    merchants: JSON.parse(row.merchants as string),
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}
