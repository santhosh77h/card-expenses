import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL = 'anthropic/claude-sonnet-4';
const TARGET_LOCALES = ['hi', 'es', 'fr', 'de'];
const LOCALE_NAMES: Record<string, string> = {
  hi: 'Hindi', es: 'Spanish', fr: 'French', de: 'German',
};

function flattenKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(result, flattenKeys(v as Record<string, unknown>, key));
    } else {
      result[key] = String(v);
    }
  }
  return result;
}

function setNestedKey(obj: Record<string, unknown>, keyPath: string, value: unknown) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

async function translateKeys(
  keys: Record<string, string>,
  targetLocale: string,
): Promise<Record<string, string>> {
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `Translate these JSON key-value pairs from English to ${LOCALE_NAMES[targetLocale]}.
Keep keys unchanged. Preserve {placeholders} and <tags> exactly.
Do NOT translate: "Vector", "Vector Expense", URLs, emails.
Return ONLY valid JSON — no explanation, no markdown fences.

${JSON.stringify(keys, null, 2)}`,
    }],
  });

  const text = response.choices[0]?.message?.content || '';
  const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(clean);
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('Error: OPENROUTER_API_KEY environment variable is required.');
    console.error('Set it in .env.local or export it before running this script.');
    process.exit(1);
  }

  const enSource = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'messages', 'en.json'), 'utf-8'),
  );
  const enFlat = flattenKeys(enSource);

  for (const locale of TARGET_LOCALES) {
    const localePath = path.join(process.cwd(), 'messages', `${locale}.json`);
    const existing = fs.existsSync(localePath)
      ? JSON.parse(fs.readFileSync(localePath, 'utf-8'))
      : {};
    const existingFlat = flattenKeys(existing);

    const diffKeys: Record<string, string> = {};
    for (const [key, val] of Object.entries(enFlat)) {
      if (!existingFlat[key]) diffKeys[key] = val;
    }

    if (Object.keys(diffKeys).length === 0) {
      console.log(`${locale}: no changes`);
      continue;
    }

    console.log(`${locale}: translating ${Object.keys(diffKeys).length} new/changed keys...`);
    const translated = await translateKeys(diffKeys, locale);

    const merged = JSON.parse(JSON.stringify(existing));
    for (const [key, val] of Object.entries(translated)) {
      setNestedKey(merged as Record<string, unknown>, key, val);
    }

    fs.writeFileSync(localePath, JSON.stringify(merged, null, 2) + '\n');
    console.log(`  ✓ messages/${locale}.json updated`);
  }
}

main().catch(console.error);
