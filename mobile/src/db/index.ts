import { open, type DB } from '@op-engineering/op-sqlite';
import { SCHEMA_SQL } from './schema';
import { migrateFromAsyncStorage } from './migrations';

let db: DB | null = null;

export function getDb(): DB {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export async function initDatabase(): Promise<void> {
  if (db) return;

  db = open({ name: 'cardlytics.db' });
  db.executeSync('PRAGMA journal_mode = WAL');
  db.executeSync('PRAGMA foreign_keys = ON');

  for (const sql of SCHEMA_SQL) {
    db.executeSync(sql);
  }

  await migrateFromAsyncStorage(db);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
