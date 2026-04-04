import { getDb } from './index';

export interface RuleCondition {
  field: 'description';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith';
  value: string;
}

export interface SmartMerchantRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  logic: 'any' | 'all';
  category?: string;
  categoryColor?: string;
  categoryIcon?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function insertRule(rule: SmartMerchantRule): void {
  getDb().executeSync(
    `INSERT INTO smart_merchant_rules (id, name, conditions, logic, category, categoryColor, categoryIcon, enabled, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      rule.id, rule.name, JSON.stringify(rule.conditions), rule.logic,
      rule.category ?? null, rule.categoryColor ?? null, rule.categoryIcon ?? null,
      rule.enabled ? 1 : 0, rule.createdAt, rule.updatedAt,
    ],
  );
}

export function getAllRules(): SmartMerchantRule[] {
  const result = getDb().executeSync(
    `SELECT * FROM smart_merchant_rules ORDER BY updatedAt DESC`,
  );
  return result.rows.map(rowToRule);
}

export function updateRule(
  id: string,
  updates: Partial<Pick<SmartMerchantRule, 'name' | 'conditions' | 'logic' | 'category' | 'categoryColor' | 'categoryIcon' | 'enabled'>>,
): void {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.conditions !== undefined) { fields.push('conditions = ?'); values.push(JSON.stringify(updates.conditions)); }
  if (updates.logic !== undefined) { fields.push('logic = ?'); values.push(updates.logic); }
  if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category ?? null); }
  if (updates.categoryColor !== undefined) { fields.push('categoryColor = ?'); values.push(updates.categoryColor ?? null); }
  if (updates.categoryIcon !== undefined) { fields.push('categoryIcon = ?'); values.push(updates.categoryIcon ?? null); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
  if (fields.length === 0) return;
  fields.push('updatedAt = ?');
  values.push(new Date().toISOString());
  values.push(id);
  getDb().executeSync(
    `UPDATE smart_merchant_rules SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteRule(id: string): void {
  getDb().executeSync(`DELETE FROM smart_merchant_rules WHERE id = ?`, [id]);
}

function rowToRule(row: Record<string, unknown>): SmartMerchantRule {
  return {
    id: row.id as string,
    name: row.name as string,
    conditions: JSON.parse(row.conditions as string),
    logic: row.logic as 'any' | 'all',
    category: (row.category as string) || undefined,
    categoryColor: (row.categoryColor as string) || undefined,
    categoryIcon: (row.categoryIcon as string) || undefined,
    enabled: row.enabled === 1,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}
