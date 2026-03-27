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
	hi: 'Hindi',
	es: 'Spanish',
	fr: 'French',
	de: 'German',
};

async function translateChunk(
	targetLocale: string,
	namespace: string,
	chunk: object
): Promise<object> {
	const response = await client.chat.completions.create({
		model: MODEL,
		max_tokens: 8000,
		messages: [
			{
				role: 'user',
				content: `You are a professional translator for a personal finance app called "Vector Expense".
Translate the following JSON from English to ${LOCALE_NAMES[targetLocale]}.

This is the "${namespace}" section of the translation file.

Rules:
- Keep ALL JSON keys exactly as-is (never translate keys)
- Do NOT translate: "Vector", "Vector Expense", "App Store", "Google Play", email addresses, URLs, domain names
- For financial terms (credit limit, statement, billing cycle, EMI) use standard banking terminology in the target language
- Preserve ALL ICU placeholders exactly: {count}, {name}, {amount}, {month}, {year}, {statements}, {days}, {time}, {author}, {highlight}
- Preserve ALL rich text tags exactly: <bold>, </bold>, <highlight>, </highlight>, <link>, </link>, <appleLink>, </appleLink>, <privacyLink>, </privacyLink>
- For Hindi: use formal register (आप, not तुम)
- Return ONLY valid JSON — no explanation, no markdown fences, no comments

JSON to translate:
${JSON.stringify(chunk, null, 2)}`,
			},
		],
	});

	const text = response.choices[0]?.message?.content || '';
	const clean = text
		.replace(/^```json\n?/, '')
		.replace(/\n?```$/, '')
		.trim();
	return JSON.parse(clean);
}

async function main() {
	if (!process.env.OPENROUTER_API_KEY) {
		console.error('Error: OPENROUTER_API_KEY environment variable is required.');
		console.error('Set it in .env.local or export it before running this script.');
		process.exit(1);
	}

	const enPath = path.join(process.cwd(), 'messages', 'en.json');
	const source = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
	const namespaces = Object.keys(source);

	for (const locale of TARGET_LOCALES) {
		console.log(`\nTranslating → ${locale} (${LOCALE_NAMES[locale]})...`);
		const translated: Record<string, object> = {};

		for (const ns of namespaces) {
			process.stdout.write(`  ${ns}...`);
			try {
				translated[ns] = await translateChunk(locale, ns, source[ns]);
				console.log(' ✓');
			} catch (err) {
				console.log(` ✗ (${err instanceof Error ? err.message : 'unknown error'})`);
				// Fall back to English for this namespace
				translated[ns] = source[ns];
			}
		}

		const outPath = path.join(process.cwd(), 'messages', `${locale}.json`);
		fs.writeFileSync(outPath, JSON.stringify(translated, null, 2) + '\n');
		console.log(`  → Written to messages/${locale}.json`);
	}
	console.log('\nDone. All locale files updated.');
}

main().catch(console.error);
