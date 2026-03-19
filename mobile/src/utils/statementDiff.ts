import type { Transaction } from '../store';

export interface TxnDiff {
  added: Transaction[];
  modified: { old: Transaction; new: Transaction }[];
  removed: Transaction[];
  unchanged: Transaction[];
}

/**
 * Normalize key for matching: date + lowercased description.
 */
function matchKey(t: Transaction): string {
  return `${t.date}|${t.description.toLowerCase()}`;
}

/**
 * Compute the diff between old and new transaction lists for a single statement.
 *
 * Matching logic: group by date+description, then match by order of appearance
 * within each group. If matched, compare amount/type/category - any difference
 * means "modified". Unmatched old = removed, unmatched new = added.
 */
export function computeStatementDiff(
  oldTxns: Transaction[],
  newTxns: Transaction[],
): TxnDiff {
  const added: Transaction[] = [];
  const modified: { old: Transaction; new: Transaction }[] = [];
  const removed: Transaction[] = [];
  const unchanged: Transaction[] = [];

  // Group old txns by match key, preserving order
  const oldGroups = new Map<string, Transaction[]>();
  for (const t of oldTxns) {
    const key = matchKey(t);
    if (!oldGroups.has(key)) oldGroups.set(key, []);
    oldGroups.get(key)!.push(t);
  }

  // Track which old txns were consumed
  const consumedOld = new Set<string>();

  // Group new txns by match key, preserving order
  const newGroups = new Map<string, Transaction[]>();
  for (const t of newTxns) {
    const key = matchKey(t);
    if (!newGroups.has(key)) newGroups.set(key, []);
    newGroups.get(key)!.push(t);
  }

  // For each new group, match against old group by position
  for (const [key, newGroup] of newGroups) {
    const oldGroup = oldGroups.get(key) || [];

    for (let i = 0; i < newGroup.length; i++) {
      const newTxn = newGroup[i];
      if (i < oldGroup.length) {
        const oldTxn = oldGroup[i];
        consumedOld.add(oldTxn.id);

        // Compare fields that matter
        const changed =
          oldTxn.amount !== newTxn.amount ||
          oldTxn.type !== newTxn.type ||
          oldTxn.category !== newTxn.category;

        if (changed) {
          modified.push({ old: oldTxn, new: newTxn });
        } else {
          unchanged.push(newTxn);
        }
      } else {
        added.push(newTxn);
      }
    }
  }

  // Any old txn not consumed is removed
  for (const t of oldTxns) {
    if (!consumedOld.has(t.id)) {
      removed.push(t);
    }
  }

  return { added, modified, removed, unchanged };
}
