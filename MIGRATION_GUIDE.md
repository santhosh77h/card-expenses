# SQLite Migration Guide

How schema migrations work in Cardlytics and how to safely evolve the database.

## How It Works

- `PRAGMA user_version` stores the schema version inside the SQLite file itself
- On every app boot, `runSchemaMigrations()` compares stored version vs `LATEST_VERSION`
- Runs each missing migration sequentially, each in its own transaction
- If a migration fails, it rolls back and the DB stays at the last successful version
- After all migrations, `validateSchema()` confirms critical tables exist

**Fresh install**: user_version=0 → runs ALL migrations 1→N sequentially.
**Upgrade**: runs only the missing migrations (e.g., user at v2 with LATEST_VERSION=4 runs v3, v4).

### Key files

| File | Role |
|------|------|
| `mobile/src/db/schema.ts` | `LATEST_VERSION` constant + `migrations` registry |
| `mobile/src/db/migrations.ts` | `runSchemaMigrations()`, `validateSchema()`, `migrateFromAsyncStorage()` |
| `mobile/src/db/index.ts` | Boot sequence that calls migration + validation |

## Rules (Non-Negotiable)

1. **Never modify a shipped migration** — once in a release, it's immutable
2. **Never delete an old migration** — users upgrade from any version
3. **New columns must have DEFAULT values** — old rows must survive
4. **Never DROP TABLE in a migration** — data loss
5. **Never DROP COLUMN** — not supported in SQLite < 3.35.0
6. **Always use IF NOT EXISTS** for CREATE TABLE/INDEX
7. **Test the full chain** — fresh install + upgrade from every prior version

## Adding a New Column

```
1. In schema.ts, bump LATEST_VERSION (e.g., 1 → 2)
2. Add migration function:
   migrations[2] = (db) => {
     db.executeSync(`ALTER TABLE transactions ADD COLUMN tags TEXT DEFAULT ''`);
   };
3. Update TypeScript types in store/index.ts
4. Update backup.ts export/restore if the field should be backed up
5. Test: fresh install (runs v1+v2), upgrade from v1 (runs v2 only)
```

## Adding a New Table

```
1. Bump LATEST_VERSION
2. Add migration with CREATE TABLE IF NOT EXISTS + indices
3. Add the table name to validateSchema() in migrations.ts
4. Create new db module file (e.g., db/newTable.ts)
5. Add CRUD functions following existing patterns
6. Wire into store if needed
7. Update backup.ts
```

## Renaming a Column

SQLite approach (pre-3.25.0 compat):

```
1. Add new column with ALTER TABLE ADD COLUMN (with DEFAULT)
2. Backfill: UPDATE table SET new_col = old_col
3. Use new column in all new code
4. Old column stays (harmless dead weight)
```

If SQLite 3.25+ is guaranteed:

```
ALTER TABLE table RENAME COLUMN old TO new
```

## Major Table Restructure

The 4-step SQLite migration pattern:

```
1. CREATE TABLE new_table (... new schema ...)
2. INSERT INTO new_table SELECT ... FROM old_table
3. DROP TABLE old_table
4. ALTER TABLE new_table RENAME TO old_table
5. Recreate indices
```

## Checklist Before Releasing a Schema Change

- [ ] Migration function added with correct version number
- [ ] `LATEST_VERSION` bumped
- [ ] New columns have DEFAULT values
- [ ] TypeScript types updated
- [ ] Store actions updated (if column affects state)
- [ ] Backup export includes new data
- [ ] Backup restore handles new data
- [ ] Tested: fresh install runs all migrations successfully
- [ ] Tested: upgrade from previous version runs new migration only
- [ ] Tested: all existing features still work after migration

## Emergency Recovery

- If migration fails on user's device, DB stays at last good version (transaction rollback)
- App should catch the migration error and show a recovery screen
- User can export backup from the last good state
- Force update via backend `minVersion` check as last resort
