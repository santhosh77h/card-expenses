# Database Entity Relationships

> Vector uses **two storage layers**: AsyncStorage (persisted Zustand state) and op-sqlite (SQLite).
> SQLite is the source of truth for all transaction data. AsyncStorage holds card definitions and UI state.

---

## Storage Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AsyncStorage (Zustand persist)                     │
│                                                                             │
│  cards: CreditCard[]          activeCardId: string | null                   │
│  isPremium: boolean           defaultCurrency: CurrencyCode                 │
│  themeMode: ThemeMode         isAuthenticated / appleUserId                 │
└─────────────────────────────────────────────────────────────────────────────┘
                          │
                          │  cardId links both layers
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SQLite (op-sqlite) — 9 tables                        │
│                                                                             │
│  meta · statements · transactions · enrichments · monthly_usage             │
│  file_hashes · transaction_edits · labels · transaction_labels              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Entity Relationship Diagram

```
                            ┌──────────────────────┐
                            │   CreditCard (AS)     │
                            │──────────────────────│
                            │ PK  id               │
                            │     nickname         │
                            │     last4            │
                            │     issuer           │
                            │     network          │
                            │     creditLimit      │
                            │     billingCycle     │
                            │     color            │
                            │     currency?        │
                            │     pdfPassword?     │
                            │     reminderDay?     │
                            └──────────┬───────────┘
                                       │
              ┌────────────────────────┼───────────────────────┐
              │ 1:N                    │ 1:N                   │ 1:N
              ▼                        ▼                       ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│    statements        │  │   monthly_usage      │  │    file_hashes       │
│──────────────────────│  │──────────────────────│  │──────────────────────│
│ PK  id               │  │ PK  cardId + month   │  │ PK  hash             │
│ FK  cardId ──────────┼──│ FK  cardId           │  │ FK  cardId           │
│     parsedAt         │  │ FK  statementId ─────┼──│ FK  statementId ─────┼──┐
│     summary (JSON)   │  │     totalDebits      │  │     createdAt        │  │
│     csv              │  │     totalCredits     │  └──────────────────────┘  │
│     bankDetected     │  │     net              │                            │
│     currency?        │  │     currency?        │       ┌────────────────────┘
│     dateFormat?      │  └──────────────────────┘       │
└──────────┬───────────┘                                 │
           │ 1:N                                         │
           │◄────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│      transactions        │
│──────────────────────────│
│ PK  id                   │
│ FK  cardId ──────────────┼──▶ CreditCard.id (AS)
│ FK  statementId ─────────┼──▶ statements.id  (CASCADE DELETE)
│     date                 │
│     description          │
│     amount               │
│     category             │
│     category_color       │
│     category_icon        │
│     type (debit/credit)  │
│     transaction_type     │
│     source (manual/stmt) │
│     isImported           │
│     currency?            │
│     created_at           │
└────┬──────┬─────────┬────┘
     │      │         │
     │      │         │ 1:N
     │      │         ▼
     │      │    ┌──────────────────────────┐
     │      │    │   transaction_edits      │
     │      │    │──────────────────────────│
     │      │    │ PK  id                   │
     │      │    │ FK  transaction_id ──────┼──▶ transactions.id (CASCADE)
     │      │    │     field                │
     │      │    │     old_value            │
     │      │    │     new_value            │
     │      │    │     edited_at            │
     │      │    │     edit_source          │
     │      │    │                          │
     │      │    │ UQ  (transaction_id,     │
     │      │    │      field)              │
     │      │    └──────────────────────────┘
     │      │
     │      │ 1:0..1
     │      ▼
     │ ┌──────────────────────────┐
     │ │     enrichments          │
     │ │──────────────────────────│
     │ │ PK  txnId ──────────────┼──▶ transactions.id
     │ │     notes?              │
     │ │     flagged (0/1)       │
     │ │     receiptUri?         │
     │ │     updatedAt?          │
     │ └──────────────────────────┘
     │
     │ N:M (via junction table)
     │
     ▼
┌──────────────────────────┐       ┌──────────────────────────┐
│  transaction_labels (JT) │       │       labels             │
│──────────────────────────│       │──────────────────────────│
│ PK  transactionId +      │       │ PK  id                   │
│     labelId              │       │ UQ  name                 │
│ FK  transactionId ───────┼──▶    │     color                │
│ FK  labelId ─────────────┼──────▶│     icon                 │
│     addedAt              │       │     createdAt            │
└──────────────────────────┘       └──────────────────────────┘
```

---

## Relationship Summary

| Relationship | Type | FK / Link | On Delete |
|---|---|---|---|
| **CreditCard → statements** | 1 : N | `statements.cardId` | — (manual) |
| **CreditCard → transactions** | 1 : N | `transactions.cardId` | — (manual) |
| **CreditCard → monthly_usage** | 1 : N | `monthly_usage.cardId` | — (manual) |
| **CreditCard → file_hashes** | 1 : N | `file_hashes.cardId` | — (manual) |
| **statements → transactions** | 1 : N | `transactions.statementId` | **CASCADE** |
| **statements → monthly_usage** | 1 : N | `monthly_usage.statementId` | — (manual) |
| **statements → file_hashes** | 1 : N | `file_hashes.statementId` | — (manual) |
| **transactions → enrichments** | 1 : 0..1 | `enrichments.txnId` | — (manual) |
| **transactions → transaction_edits** | 1 : N | `transaction_edits.transaction_id` | **CASCADE** |
| **transactions ↔ labels** | N : M | `transaction_labels` (junction) | **CASCADE** (both FKs) |

> **"manual"** means the app code handles deletion (no SQL CASCADE). Only `statements→transactions`, `transactions→transaction_edits`, and both sides of `transaction_labels` have CASCADE DELETE.

---

## Key Concepts

### Two kinds of transactions
- **`source = 'statement'`** — parsed from a PDF, linked to a `statementId`. Deleting a statement cascades to these.
- **`source = 'manual'`** — user-entered, `statementId` is NULL, `isImported = 0`.

### Non-destructive edits
`transaction_edits` stores field-level overrides. The original values in `transactions` are never mutated — the app merges edits at read time. Unique constraint on `(transaction_id, field)` means at most one active override per field.

### File deduplication
`file_hashes` maps a PDF's SHA-256 hash to a statement. Before parsing, the app checks this table to prevent re-importing the same PDF.

### CreditCard lives in AsyncStorage
Cards are NOT in SQLite. They're persisted via Zustand's `persist` middleware to AsyncStorage. All SQLite tables reference `cardId` as a string but there's **no enforced FK** — the app manages this relationship in code.

### Hydration order
1. `initDatabase()` — runs migrations
2. Zustand hydrates `cards` + `activeCardId` from AsyncStorage
3. `_hydrateSqlite()` loads transactions/statements/enrichments/monthlyUsage/labels/transactionLabels from SQLite
4. `dbReady` gate flips → UI renders

---

## Indexes

| Table | Index | Columns |
|---|---|---|
| statements | `idx_stmt_cardId` | cardId |
| statements | `idx_stmt_parsedAt` | parsedAt |
| transactions | `idx_txn_date` | date |
| transactions | `idx_txn_cardId` | cardId |
| transactions | `idx_txn_statementId` | statementId |
| transactions | `idx_txn_source` | source, isImported |
| transaction_edits | `idx_txn_edit_field` (UNIQUE) | transaction_id, field |
| transaction_edits | `idx_txn_edit_txn_id` | transaction_id |
| transaction_labels | `idx_txn_labels_label_id` | labelId |
| monthly_usage | `idx_mu_statementId` | statementId |
| file_hashes | `idx_fh_statementId` | statementId |
| file_hashes | `idx_fh_cardId` | cardId |
