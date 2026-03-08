import type { DB } from '@op-engineering/op-sqlite';

export const LATEST_VERSION = 1;

export type MigrationFn = (db: DB) => void;

// Each migration takes the DB from version N-1 to version N.
// RULE: Never modify a shipped migration. Only append new ones.
export const migrations: Record<number, MigrationFn> = {
  // v0 → v1: Initial schema (all current tables + indices)
  1: (db) => {
    db.executeSync(
      `CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    );

    db.executeSync(
      `CREATE TABLE IF NOT EXISTS statements (
        id            TEXT PRIMARY KEY,
        cardId        TEXT NOT NULL,
        parsedAt      TEXT NOT NULL,
        summary       TEXT NOT NULL,
        csv           TEXT NOT NULL,
        bankDetected  TEXT NOT NULL,
        currency      TEXT
      )`,
    );
    db.executeSync(
      `CREATE INDEX IF NOT EXISTS idx_stmt_cardId ON statements(cardId)`,
    );

    db.executeSync(
      `CREATE TABLE IF NOT EXISTS transactions (
        id              TEXT PRIMARY KEY,
        date            TEXT NOT NULL,
        description     TEXT NOT NULL,
        amount          REAL NOT NULL,
        category        TEXT NOT NULL,
        category_color  TEXT NOT NULL,
        category_icon   TEXT NOT NULL,
        type            TEXT NOT NULL CHECK(type IN ('debit', 'credit')),
        cardId          TEXT,
        currency        TEXT,
        source          TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'statement')),
        statementId     TEXT,
        isImported      INTEGER NOT NULL DEFAULT 0,
        created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        FOREIGN KEY (statementId) REFERENCES statements(id) ON DELETE CASCADE
      )`,
    );
    db.executeSync(
      `CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(date)`,
    );
    db.executeSync(
      `CREATE INDEX IF NOT EXISTS idx_txn_cardId ON transactions(cardId)`,
    );
    db.executeSync(
      `CREATE INDEX IF NOT EXISTS idx_txn_statementId ON transactions(statementId)`,
    );
    db.executeSync(
      `CREATE INDEX IF NOT EXISTS idx_txn_source ON transactions(source, isImported)`,
    );

    db.executeSync(
      `CREATE TABLE IF NOT EXISTS enrichments (
        txnId       TEXT PRIMARY KEY,
        notes       TEXT,
        flagged     INTEGER NOT NULL DEFAULT 0,
        receiptUri  TEXT,
        updatedAt   TEXT
      )`,
    );

    db.executeSync(
      `CREATE TABLE IF NOT EXISTS monthly_usage (
        cardId       TEXT NOT NULL,
        month        TEXT NOT NULL,
        totalDebits  REAL NOT NULL,
        totalCredits REAL NOT NULL,
        net          REAL NOT NULL,
        statementId  TEXT NOT NULL,
        currency     TEXT,
        PRIMARY KEY (cardId, month)
      )`,
    );

    db.executeSync(
      `CREATE TABLE IF NOT EXISTS file_hashes (
        hash        TEXT PRIMARY KEY,
        statementId TEXT NOT NULL,
        cardId      TEXT NOT NULL,
        createdAt   TEXT NOT NULL
      )`,
    );
  },

  // FUTURE EXAMPLE (not implemented now):
  // 2: (db) => {
  //   db.executeSync(`ALTER TABLE transactions ADD COLUMN tags TEXT DEFAULT ''`);
  //   db.executeSync(`CREATE INDEX IF NOT EXISTS idx_txn_tags ON transactions(tags)`);
  // },
};
