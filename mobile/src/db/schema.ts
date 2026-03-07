export const SCHEMA_VERSION = 1;

// Statements must be created before transactions due to FK constraint.
export const SCHEMA_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS statements (
    id            TEXT PRIMARY KEY,
    cardId        TEXT NOT NULL,
    parsedAt      TEXT NOT NULL,
    summary       TEXT NOT NULL,
    csv           TEXT NOT NULL,
    bankDetected  TEXT NOT NULL,
    currency      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_stmt_cardId ON statements(cardId)`,

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
  `CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(date)`,
  `CREATE INDEX IF NOT EXISTS idx_txn_cardId ON transactions(cardId)`,
  `CREATE INDEX IF NOT EXISTS idx_txn_statementId ON transactions(statementId)`,
  `CREATE INDEX IF NOT EXISTS idx_txn_source ON transactions(source, isImported)`,

  `CREATE TABLE IF NOT EXISTS enrichments (
    txnId       TEXT PRIMARY KEY,
    notes       TEXT,
    flagged     INTEGER NOT NULL DEFAULT 0,
    receiptUri  TEXT,
    updatedAt   TEXT
  )`,

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
];
