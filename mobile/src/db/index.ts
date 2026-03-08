import { open, type DB } from '@op-engineering/op-sqlite';
import { runSchemaMigrations, validateSchema, migrateFromAsyncStorage } from './migrations';

let db: DB | null = null;

export function getDb(): DB {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export async function initDatabase(): Promise<void> {
  if (db) return;

  db = open({ name: 'vector.db' });
  db.executeSync('PRAGMA journal_mode = WAL');
  db.executeSync('PRAGMA foreign_keys = ON');

  // Run versioned schema migrations (creates tables on fresh install,
  // alters schema on upgrade)
  runSchemaMigrations(db);

  // One-time data migration from old AsyncStorage format
  await migrateFromAsyncStorage(db);

  // Validate critical tables exist
  validateSchema(db);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
