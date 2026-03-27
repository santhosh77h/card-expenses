import type { DB } from '@op-engineering/op-sqlite';

export const LATEST_VERSION = 6;

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

  // v1 → v2: Add dateFormat column to statements (Stage 1 Document Intelligence)
  2: (db) => {
    db.executeSync(`ALTER TABLE statements ADD COLUMN dateFormat TEXT`);
  },

  // v2 → v3: Add transaction_type column to transactions
  3: (db) => {
    db.executeSync(
      `ALTER TABLE transactions ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'purchase'`,
    );
  },

  // v3 → v4: Add missing indexes
  4: (db) => {
    db.executeSync(
      `CREATE INDEX IF NOT EXISTS idx_mu_statementId ON monthly_usage(statementId)`,
    );
    db.executeSync(
      `CREATE INDEX IF NOT EXISTS idx_fh_statementId ON file_hashes(statementId)`,
    );
    db.executeSync(
      `CREATE INDEX IF NOT EXISTS idx_fh_cardId ON file_hashes(cardId)`,
    );
    db.executeSync(
      `CREATE INDEX IF NOT EXISTS idx_stmt_parsedAt ON statements(parsedAt)`,
    );
  },

  // v4 → v5: Non-destructive transaction editing (YNAB/Monarch model)
  5: (db) => {
    db.executeSync(
      `CREATE TABLE IF NOT EXISTS transaction_edits (
        id              TEXT PRIMARY KEY,
        transaction_id  TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        field           TEXT NOT NULL,
        old_value       TEXT NOT NULL,
        new_value       TEXT NOT NULL,
        edited_at       INTEGER NOT NULL,
        edit_source     TEXT NOT NULL DEFAULT 'user'
      )`,
    );
    db.executeSync(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_edit_field ON transaction_edits(transaction_id, field)`,
    );
    db.executeSync(
      `CREATE INDEX IF NOT EXISTS idx_txn_edit_txn_id ON transaction_edits(transaction_id)`,
    );
  },

  // v5 → v6: Labels (multi-tag per transaction)
  6: (db) => {
    db.executeSync(
      `CREATE TABLE IF NOT EXISTS labels (
        id        TEXT PRIMARY KEY,
        name      TEXT NOT NULL UNIQUE,
        color     TEXT NOT NULL,
        icon      TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )`,
    );
    db.executeSync(
      `CREATE TABLE IF NOT EXISTS transaction_labels (
        transactionId TEXT NOT NULL,
        labelId       TEXT NOT NULL,
        addedAt       TEXT NOT NULL,
        PRIMARY KEY (transactionId, labelId),
        FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (labelId) REFERENCES labels(id) ON DELETE CASCADE
      )`,
    );
    db.executeSync(
      `CREATE INDEX IF NOT EXISTS idx_txn_labels_label_id ON transaction_labels(labelId)`,
    );
  },
};
