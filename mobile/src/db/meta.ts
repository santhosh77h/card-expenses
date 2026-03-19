import { getDb } from './index';

export function getMeta(key: string): string | null {
  const result = getDb().executeSync(
    `SELECT value FROM meta WHERE key = ?`,
    [key],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].value as string;
}

export function setMeta(key: string, value: string): void {
  getDb().executeSync(
    `INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`,
    [key, value],
  );
}

export function getMetaInt(key: string, defaultValue = 0): number {
  const val = getMeta(key);
  if (val === null) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function setMetaInt(key: string, value: number): void {
  setMeta(key, String(value));
}
