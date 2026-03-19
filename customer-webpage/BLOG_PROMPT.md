# Vector Blog Post Generator Prompt

Copy everything below the line and paste it into Claude along with your topic/idea.

---

## Prompt

I need you to generate a blog post for **Vector Expense** (vectorexpense.com) — a privacy-first, AI-powered credit card statement parser app. The blog lives at `/blog` on our marketing site.

**Output each field separately so I can copy-paste them into the admin form.**

### Fields to generate

| # | Field | Format | Notes |
|---|-------|--------|-------|
| 1 | **Title** | Plain text, under 70 chars | SEO-friendly, compelling |
| 2 | **Slug** | lowercase-kebab-case | Auto-derived from title |
| 3 | **Excerpt** | 1-2 sentences, under 160 chars | Used as meta description |
| 4 | **Category** | One of: `Privacy`, `Engineering`, `Guide`, `Finance`, `Product`, `Security`, `General` | Pick the best fit |
| 5 | **Tags** | Comma-separated lowercase keywords | 3-6 tags |
| 6 | **Author** | Default: `Vector Team` | Or a specific name |
| 7 | **Read Time** | Integer (minutes) | Estimate based on word count (~250 wpm) |
| 8 | **Content** | Markdown (see syntax rules below) | The full article body |
| 9 | **FAQ** | 3-5 Q&A pairs | Real, useful questions someone would search for relevant to the blogs posts |

### Content Markdown Rules

Our renderer supports a **limited subset** of Markdown. Only use these:

```
# H1 Heading
## H2 Heading
### H3 Heading
Regular paragraph text.
**bold text**
`inline code`
- Unordered list item
- Another item
1. Ordered list item
2. Another item
> Blockquote text
---
```

**DO NOT use:**
- Links `[text](url)` — they render as plain text
- Images `![alt](url)` — not supported
- Code fences ` ``` ` — not supported
- Tables — not supported
- Nested lists — not supported
- HTML tags — not supported

### Content Structure Guidelines

- Start with a `# Title` heading that matches the Title field
- Use `## Section` headings to break the article into 3-6 sections
- Use `### Subsection` for deeper dives within sections
- Keep paragraphs short (2-4 sentences)
- Use lists for scannable information
- End with a bold tagline like: **Your money. Directed.**
- Aim for 800-1500 words
- Write in a confident, direct tone — no fluff, no marketing speak
- The article should provide genuine value, not just promote Vector

### FAQ Guidelines

Generate 3-5 FAQ items as separate question/answer pairs:

```
Q1: [Question someone would actually Google]
A1: [Direct 2-3 sentence answer]

Q2: ...
A2: ...
```

- Questions should be things people actually search for related to the topic
- Answers should be concise and self-contained
- At least 1 FAQ should relate the topic back to Vector's features
- These generate FAQPage JSON-LD schema for SEO — make them count

### Output Format

Please output like this so I can copy each field directly:

```
TITLE: ...

SLUG: ...

EXCERPT: ...

CATEGORY: ...

TAGS: ...

AUTHOR: ...

READ TIME: ...

CONTENT:
[full markdown content here]

FAQ:
Q1: ...
A1: ...

Q2: ...
A2: ...

Q3: ...
A3: ...
```

### About Vector Expense

Key facts to reference accurately:
- Privacy-first: zero data retention, PDFs processed in-memory and discarded
- 3-model AI consensus engine (GPT-4o-mini, Claude 3.5 Haiku, Gemini 2.0 Flash) with majority voting
- Supports 33+ banks across India, US, UK
- Currencies: INR, USD, EUR, GBP
- 12 spending categories auto-assigned
- All data stored locally in encrypted SQLite on device
- No account needed, no sign-up
- CSV export, encrypted backups
- Free tier: 3 uploads/month; Pro: 10 bank statements at $5/month, $36/year

---

**My topic/idea:** [REPLACE THIS WITH YOUR BLOG TOPIC]
