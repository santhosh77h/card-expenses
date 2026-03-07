import { getDb } from './index';
import type { TransactionEnrichment } from '../store';

export function upsertEnrichment(txnId: string, enrichment: TransactionEnrichment): void {
  getDb().executeSync(
    `INSERT OR REPLACE INTO enrichments (txnId, notes, flagged, receiptUri, updatedAt)
     VALUES (?, ?, ?, ?, ?)`,
    [txnId, enrichment.notes ?? null, enrichment.flagged ? 1 : 0, enrichment.receiptUri ?? null, enrichment.updatedAt ?? null],
  );
}

export function getAllEnrichments(): Record<string, TransactionEnrichment> {
  const db = getDb();
  const result = db.executeSync(`SELECT * FROM enrichments`);

  const map: Record<string, TransactionEnrichment> = {};
  for (const row of result.rows) {
    map[row.txnId as string] = {
      notes: (row.notes as string | null) ?? undefined,
      flagged: row.flagged === 1,
      receiptUri: (row.receiptUri as string | null) ?? undefined,
      updatedAt: (row.updatedAt as string | null) ?? undefined,
    };
  }
  return map;
}

export function deleteEnrichment(txnId: string): void {
  getDb().executeSync(`DELETE FROM enrichments WHERE txnId = ?`, [txnId]);
}

export function deleteEnrichments(txnIds: string[]): void {
  if (txnIds.length === 0) return;
  const db = getDb();
  const placeholders = txnIds.map(() => '?').join(',');
  db.executeSync(`DELETE FROM enrichments WHERE txnId IN (${placeholders})`, txnIds);
}
