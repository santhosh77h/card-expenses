import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DB } from '@op-engineering/op-sqlite';
import { LATEST_VERSION, migrations } from './schema';

/**
 * Runs sequential schema migrations using PRAGMA user_version.
 * Fresh install (user_version=0) runs ALL migrations 1→N.
 * Upgrades run only the missing ones.
 * Each migration is wrapped in its own transaction.
 */
export function runSchemaMigrations(db: DB): void {
  const result = db.executeSync('PRAGMA user_version');
  const currentVersion = (result.rows[0]?.user_version as number) ?? 0;

  if (currentVersion >= LATEST_VERSION) return;

  for (let v = currentVersion + 1; v <= LATEST_VERSION; v++) {
    const migrationFn = migrations[v];
    if (!migrationFn) {
      throw new Error(`Missing migration for version ${v}`);
    }

    db.executeSync('BEGIN');
    try {
      migrationFn(db);
      db.executeSync(`PRAGMA user_version = ${v}`);
      db.executeSync('COMMIT');
    } catch (e) {
      db.executeSync('ROLLBACK');
      throw new Error(`Migration to v${v} failed: ${e}`);
    }
  }
}

/**
 * Post-migration sanity check that critical tables exist.
 */
export function validateSchema(db: DB): void {
  const tables = ['statements', 'transactions', 'enrichments', 'monthly_usage', 'file_hashes'];
  for (const table of tables) {
    const result = db.executeSync(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [table],
    );
    if (result.rows.length === 0) {
      throw new Error(`Schema validation failed: table '${table}' missing`);
    }
  }
}

export async function migrateFromAsyncStorage(db: DB): Promise<void> {
  const check = db.executeSync(
    `SELECT value FROM meta WHERE key = 'asyncstorage_migrated'`,
  );
  if (check.rows.length > 0 && check.rows[0].value === 'true') {
    return;
  }

  const raw = await AsyncStorage.getItem('cardlytics-storage');
  if (!raw) {
    db.executeSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('asyncstorage_migrated', 'true')`);
    return;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    db.executeSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('asyncstorage_migrated', 'true')`);
    return;
  }

  const state = parsed?.state;
  if (!state) {
    db.executeSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('asyncstorage_migrated', 'true')`);
    return;
  }

  const manualTransactions: any[] = state.manualTransactions ?? [];
  const statements: Record<string, any[]> = state.statements ?? {};
  const enrichments: Record<string, any> = state.enrichments ?? {};
  const monthlyUsage: any[] = state.monthlyUsage ?? [];

  db.executeSync('BEGIN');
  try {
    // Insert statements and their transactions
    for (const [cardId, stmts] of Object.entries(statements)) {
      for (const stmt of stmts) {
        db.executeSync(
          `INSERT OR REPLACE INTO statements (id, cardId, parsedAt, summary, csv, bankDetected, currency)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [stmt.id, cardId, stmt.parsedAt, JSON.stringify(stmt.summary), stmt.csv, stmt.bankDetected, stmt.currency ?? null],
        );

        for (const txn of (stmt.transactions ?? [])) {
          db.executeSync(
            `INSERT OR REPLACE INTO transactions
              (id, date, description, amount, category, category_color, category_icon, type, cardId, currency, source, statementId, isImported, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'statement', ?, 0, strftime('%s','now'))`,
            [txn.id, txn.date, txn.description, txn.amount, txn.category, txn.category_color, txn.category_icon, txn.type, txn.cardId ?? cardId, txn.currency ?? null, stmt.id],
          );
        }
      }
    }

    // Insert manual transactions
    for (const txn of manualTransactions) {
      db.executeSync(
        `INSERT OR REPLACE INTO transactions
          (id, date, description, amount, category, category_color, category_icon, type, cardId, currency, source, statementId, isImported, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', NULL, 0, strftime('%s','now'))`,
        [txn.id, txn.date, txn.description, txn.amount, txn.category, txn.category_color, txn.category_icon, txn.type, txn.cardId ?? null, txn.currency ?? null],
      );
    }

    // Insert enrichments
    for (const [txnId, enrichment] of Object.entries(enrichments)) {
      const e = enrichment as any;
      db.executeSync(
        `INSERT OR REPLACE INTO enrichments (txnId, notes, flagged, receiptUri, updatedAt)
         VALUES (?, ?, ?, ?, ?)`,
        [txnId, e.notes ?? null, e.flagged ? 1 : 0, e.receiptUri ?? null, e.updatedAt ?? null],
      );
    }

    // Insert monthly usage
    for (const usage of monthlyUsage) {
      db.executeSync(
        `INSERT OR REPLACE INTO monthly_usage (cardId, month, totalDebits, totalCredits, net, statementId, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [usage.cardId, usage.month, usage.totalDebits, usage.totalCredits, usage.net, usage.statementId, usage.currency ?? null],
      );
    }

    // Mark migration done
    db.executeSync(`INSERT OR REPLACE INTO meta (key, value) VALUES ('asyncstorage_migrated', 'true')`);
    db.executeSync('COMMIT');
  } catch (e) {
    db.executeSync('ROLLBACK');
    throw e;
  }

  // Re-write AsyncStorage keeping only cards + activeCardId
  const trimmed = {
    state: {
      cards: state.cards ?? [],
      activeCardId: state.activeCardId ?? null,
    },
    version: parsed.version,
  };
  await AsyncStorage.setItem('cardlytics-storage', JSON.stringify(trimmed));
}
