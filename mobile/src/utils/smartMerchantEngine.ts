import type { SmartMerchantRule, RuleCondition } from '../db/smartMerchantRules';

function checkCondition(description: string, condition: RuleCondition): boolean {
  const lower = description.toLowerCase();
  const val = condition.value.toLowerCase();
  switch (condition.operator) {
    case 'contains': return lower.includes(val);
    case 'equals': return lower === val;
    case 'startsWith': return lower.startsWith(val);
    case 'endsWith': return lower.endsWith(val);
    default: return false;
  }
}

export function matchRule(description: string, rule: SmartMerchantRule): boolean {
  if (!rule.enabled || rule.conditions.length === 0) return false;
  return rule.logic === 'any'
    ? rule.conditions.some((c) => checkCondition(description, c))
    : rule.conditions.every((c) => checkCondition(description, c));
}

export interface SmartMerchantMatch {
  displayName: string;
  category?: string;
  categoryColor?: string;
  categoryIcon?: string;
}

export function resolveSmartMerchant(
  description: string,
  rules: SmartMerchantRule[],
): SmartMerchantMatch | null {
  for (const rule of rules) {
    if (matchRule(description, rule)) {
      return {
        displayName: rule.name,
        category: rule.category,
        categoryColor: rule.categoryColor,
        categoryIcon: rule.categoryIcon,
      };
    }
  }
  return null;
}

/** Count how many transactions match a rule (for live preview). */
export function countMatches(
  transactions: { description: string }[],
  rule: Pick<SmartMerchantRule, 'conditions' | 'logic' | 'enabled'>,
): { count: number; samples: { description: string }[] } {
  const fakeRule = { ...rule, id: '', name: '', createdAt: '', updatedAt: '' } as SmartMerchantRule;
  const matches: { description: string }[] = [];
  for (const txn of transactions) {
    if (matchRule(txn.description, fakeRule)) {
      matches.push(txn);
    }
  }
  return { count: matches.length, samples: matches.slice(0, 5) };
}
