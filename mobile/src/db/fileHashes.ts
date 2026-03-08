import { getDb } from './index';

export interface FileHashRecord {
  hash: string;
  statementId: string;
  cardId: string;
  createdAt: string;
}

export function insertFileHash(hash: string, statementId: string, cardId: string): void {
  getDb().executeSync(
    `INSERT OR REPLACE INTO file_hashes (hash, statementId, cardId, createdAt) VALUES (?, ?, ?, ?)`,
    [hash, statementId, cardId, new Date().toISOString()],
  );
}

export function findByHash(hash: string): FileHashRecord | null {
  const result = getDb().executeSync(
    `SELECT * FROM file_hashes WHERE hash = ?`,
    [hash],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    hash: row.hash as string,
    statementId: row.statementId as string,
    cardId: row.cardId as string,
    createdAt: row.createdAt as string,
  };
}

export function deleteFileHashesByStatementId(statementId: string): void {
  getDb().executeSync(`DELETE FROM file_hashes WHERE statementId = ?`, [statementId]);
}

export function deleteFileHashesByCardId(cardId: string): void {
  getDb().executeSync(`DELETE FROM file_hashes WHERE cardId = ?`, [cardId]);
}
