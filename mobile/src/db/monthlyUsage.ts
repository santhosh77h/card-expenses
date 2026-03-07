import { getDb } from './index';
import type { MonthlyUsage } from '../store';
import type { CurrencyCode } from '../theme';

export function upsertMonthlyUsage(usage: MonthlyUsage): void {
  getDb().executeSync(
    `INSERT OR REPLACE INTO monthly_usage (cardId, month, totalDebits, totalCredits, net, statementId, currency)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [usage.cardId, usage.month, usage.totalDebits, usage.totalCredits, usage.net, usage.statementId, usage.currency ?? null],
  );
}

export function getAllMonthlyUsage(): MonthlyUsage[] {
  const db = getDb();
  const result = db.executeSync(`SELECT * FROM monthly_usage`);
  return result.rows.map((row) => ({
    cardId: row.cardId as string,
    month: row.month as string,
    totalDebits: row.totalDebits as number,
    totalCredits: row.totalCredits as number,
    net: row.net as number,
    statementId: row.statementId as string,
    currency: (row.currency as CurrencyCode | null) ?? undefined,
  }));
}

export function deleteMonthlyUsageByCardId(cardId: string): void {
  getDb().executeSync(`DELETE FROM monthly_usage WHERE cardId = ?`, [cardId]);
}
