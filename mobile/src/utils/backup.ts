import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import { getDb } from '../db';
import { useStore } from '../store';
import type { CreditCard, StatementData, Transaction, TransactionEnrichment, MonthlyUsage } from '../store';
import type { FileHashRecord } from '../db/fileHashes';
import * as dbStmts from '../db/statements';
import * as dbTxns from '../db/transactions';
import * as dbEnrich from '../db/enrichments';
import * as dbUsage from '../db/monthlyUsage';
import * as dbFileHashes from '../db/fileHashes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackupSummary {
  cardCount: number;
  statementCount: number;
  transactionCount: number;
  manualTransactionCount: number;
  enrichmentCount: number;
}

export interface BackupData {
  version: number;
  appName: 'vector';
  exportedAt: string;
  summary: BackupSummary;
  data: {
    cards: CreditCard[];
    activeCardId: string | null;
    statements: Record<string, StatementData[]>;
    manualTransactions: Transaction[];
    importedStatementIds: string[];
    enrichments: Record<string, TransactionEnrichment>;
    monthlyUsage: MonthlyUsage[];
    fileHashes: FileHashRecord[];
  };
}

// Envelope for encrypted backups — keeps appName visible so we can identify
// the file without decrypting, and the summary so we can show a preview.
export interface EncryptedBackup {
  appName: 'vector';
  encrypted: true;
  summary: BackupSummary;
  exportedAt: string;
  payload: string; // AES-encrypted JSON string of BackupData
}

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

function encrypt(json: string, password: string): string {
  return CryptoJS.AES.encrypt(json, password).toString();
}

function decrypt(ciphertext: string, password: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, password);
  const result = bytes.toString(CryptoJS.enc.Utf8);
  if (!result) {
    throw new Error('Incorrect password. Could not decrypt backup.');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateBackup(json: any): { valid: true; data: BackupData } | { valid: false; error: string } {
  if (!json || typeof json !== 'object') {
    return { valid: false, error: 'The selected file is not valid JSON.' };
  }
  if (json.appName !== 'vector') {
    return { valid: false, error: 'This file is not a Vector backup.' };
  }
  if (typeof json.version !== 'number' || json.version > 1) {
    return { valid: false, error: 'This backup was created by a newer version of the app. Please update Vector.' };
  }
  if (!json.data || typeof json.data !== 'object') {
    return { valid: false, error: 'Backup file is missing data.' };
  }
  const d = json.data;
  if (!Array.isArray(d.cards) || typeof d.statements !== 'object' || !Array.isArray(d.manualTransactions)) {
    return { valid: false, error: 'Backup file has an invalid structure.' };
  }
  return { valid: true, data: json as BackupData };
}

export function isEncryptedBackup(json: any): json is EncryptedBackup {
  return json && json.appName === 'vector' && json.encrypted === true && typeof json.payload === 'string';
}

export function decryptBackup(encrypted: EncryptedBackup, password: string): BackupData {
  const jsonStr = decrypt(encrypted.payload, password);
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Incorrect password. Could not decrypt backup.');
  }
  const validation = validateBackup(parsed);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  return validation.data;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportBackup(password: string): Promise<void> {
  const db = getDb();
  const { cards, activeCardId } = useStore.getState();
  const statements = dbStmts.getAllStatements();
  const manualTransactions = dbTxns.getManualTransactions();
  const enrichments = dbEnrich.getAllEnrichments();
  const monthlyUsage = dbUsage.getAllMonthlyUsage();
  const fileHashes = dbFileHashes.getAllFileHashes();

  // Track which statements had their transactions imported to the transaction list
  const importedResult = db.executeSync(
    `SELECT DISTINCT statementId FROM transactions WHERE source = 'statement' AND isImported = 1 AND statementId IS NOT NULL`,
  );
  const importedStatementIds = importedResult.rows.map((r) => r.statementId as string);

  // Strip receiptUri from enrichments (local paths aren't transferable)
  const cleanedEnrichments: Record<string, TransactionEnrichment> = {};
  for (const [id, e] of Object.entries(enrichments)) {
    cleanedEnrichments[id] = { ...e, receiptUri: undefined };
  }

  // Count total statement transactions
  let statementTxnCount = 0;
  for (const stmts of Object.values(statements)) {
    for (const s of stmts) {
      statementTxnCount += s.transactions.length;
    }
  }

  const backup: BackupData = {
    version: 1,
    appName: 'vector',
    exportedAt: new Date().toISOString(),
    summary: {
      cardCount: cards.length,
      statementCount: Object.values(statements).reduce((sum, arr) => sum + arr.length, 0),
      transactionCount: statementTxnCount,
      manualTransactionCount: manualTransactions.length,
      enrichmentCount: Object.keys(cleanedEnrichments).length,
    },
    data: {
      cards,
      activeCardId,
      statements,
      manualTransactions,
      importedStatementIds,
      enrichments: cleanedEnrichments,
      monthlyUsage,
      fileHashes,
    },
  };

  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const filename = `vector-backup-${ts}.json`;
  const filePath = `${FileSystem.cacheDirectory}${filename}`;

  const envelope: EncryptedBackup = {
    appName: 'vector',
    encrypted: true,
    summary: backup.summary,
    exportedAt: backup.exportedAt,
    payload: encrypt(JSON.stringify(backup), password),
  };
  const fileContent = JSON.stringify(envelope, null, 2);

  await FileSystem.writeAsStringAsync(filePath, fileContent);
  await Sharing.shareAsync(filePath, {
    mimeType: 'application/json',
    dialogTitle: 'Export Vector Backup',
    UTI: 'public.json',
  });
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export async function importBackup(): Promise<EncryptedBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const uri = result.assets[0].uri;
  const content = await FileSystem.readAsStringAsync(uri);

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!isEncryptedBackup(parsed)) {
    if (parsed && parsed.appName === 'vector') {
      throw new Error('This backup is not encrypted and cannot be imported. Please re-export with a password.');
    }
    throw new Error('This file is not a Vector backup.');
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

export function restoreBackup(backup: BackupData): void {
  const db = getDb();
  const { cards, activeCardId, statements, manualTransactions, importedStatementIds, enrichments, monthlyUsage, fileHashes } = backup.data;
  const importedSet = new Set(importedStatementIds ?? []);

  db.executeSync('BEGIN');
  try {
    // Clear all existing data (order matters for FKs)
    db.executeSync('DELETE FROM file_hashes');
    db.executeSync('DELETE FROM enrichments');
    db.executeSync('DELETE FROM monthly_usage');
    db.executeSync('DELETE FROM transactions');
    db.executeSync('DELETE FROM statements');

    // Insert statements + their transactions
    for (const [cardId, stmts] of Object.entries(statements)) {
      for (const stmt of stmts) {
        db.executeSync(
          `INSERT OR REPLACE INTO statements (id, cardId, parsedAt, summary, csv, bankDetected, currency)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [stmt.id, cardId, stmt.parsedAt, JSON.stringify(stmt.summary), stmt.csv, stmt.bankDetected, stmt.currency ?? null],
        );
        const imported = importedSet.has(stmt.id) ? 1 : 0;
        for (const txn of stmt.transactions) {
          db.executeSync(
            `INSERT OR REPLACE INTO transactions
              (id, date, description, amount, category, category_color, category_icon, type, cardId, currency, source, statementId, isImported, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'statement', ?, ?, strftime('%s','now'))`,
            [txn.id, txn.date, txn.description, txn.amount, txn.category, txn.category_color, txn.category_icon, txn.type, cardId, txn.currency ?? null, stmt.id, imported],
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
    for (const [txnId, e] of Object.entries(enrichments)) {
      db.executeSync(
        `INSERT OR REPLACE INTO enrichments (txnId, notes, flagged, receiptUri, updatedAt)
         VALUES (?, ?, ?, ?, ?)`,
        [txnId, e.notes ?? null, e.flagged ? 1 : 0, null, e.updatedAt ?? null],
      );
    }

    // Insert monthly usage
    for (const u of monthlyUsage) {
      db.executeSync(
        `INSERT OR REPLACE INTO monthly_usage (cardId, month, totalDebits, totalCredits, net, statementId, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [u.cardId, u.month, u.totalDebits, u.totalCredits, u.net, u.statementId, u.currency ?? null],
      );
    }

    // Insert file hashes
    for (const fh of fileHashes) {
      db.executeSync(
        `INSERT OR REPLACE INTO file_hashes (hash, statementId, cardId, createdAt)
         VALUES (?, ?, ?, ?)`,
        [fh.hash, fh.statementId, fh.cardId, fh.createdAt],
      );
    }

    db.executeSync('COMMIT');
  } catch (e) {
    db.executeSync('ROLLBACK');
    throw new Error('Restore failed. Your data has not been changed.');
  }

  // Update AsyncStorage (Zustand persist store)
  const persistPayload = JSON.stringify({
    state: { cards, activeCardId },
    version: 0,
  });
  AsyncStorage.setItem('vector-storage', persistPayload);

  // Rehydrate Zustand
  useStore.setState({ cards, activeCardId });
  useStore.getState()._hydrateSqlite();
}
