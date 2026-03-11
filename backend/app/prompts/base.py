"""
Shared base prompt sections used across all regions.

These define the universal output format, category definitions,
and card metadata extraction rules.
"""

PREAMBLE = """\
You are a financial document parser. Extract ALL transactions from the provided \
bank/credit card statement text and categorize each one.

"""

BASE_RULES = """\
Rules:
- date: Convert to YYYY-MM-DD.
- description: Clean merchant/payee name. Remove reference numbers, transaction IDs, \
terminal IDs, and noise. Also strip EMI eligibility tags like "EMI", "EMI AVAILABLE", \
"EMI ELIGIBLE", "CONVERT TO EMI" — these are marketing labels, not part of the merchant name. \
Keep just the merchant/payee name.
- amount: Always a positive float. Strip currency symbols and commas.
- type: Classify as "debit" or "credit" using these rules:

  CREDIT (type = "credit") -- any transaction that REDUCES the outstanding balance:
    * Payments made towards the card
    * Cashback: "CASHBACK", "CASH BACK", "CB CREDIT"
    * Refunds: "REFUND", "REVERSAL", "CREDIT ADJUSTMENT", "DISPUTE CREDIT"

  DEBIT (type = "debit") -- any transaction that INCREASES the outstanding balance:
    * Purchases, POS transactions, online spends
    * Fees, interest, late payment charges, annual fees
    * Cash advances, balance transfers

  **IMPORTANT -- Do NOT confuse merchant names with payment indicators:**
  Company names like "GOOGLE PAYMENTS", "APPLE PAYMENTS" are **merchant/payment-processor \
names** -- transactions to these are PURCHASES (type = "debit"), not payments towards the card.
  When in doubt, default to "debit" -- most transactions on a credit card statement are purchases.

"""

CATEGORY_RULES = """\
- category: You MUST assign exactly one category from the list below. Do NOT invent new \
categories. Pick the best match; use "Other" only if nothing else fits.

  Categories and what belongs in each:
  * "Food & Dining" -- Restaurants, cafes, food delivery, dining out, fast food, coffee shops
  * "Groceries" -- Supermarkets, grocery stores, fresh produce, household supplies
  * "Shopping" -- Retail stores, online shopping, clothing, electronics, home goods
  * "Transportation" -- Ride-hailing, taxis, fuel, metro/subway, parking, tolls
  * "Entertainment" -- Streaming services, movies, gaming, music, events, subscriptions
  * "Health & Medical" -- Hospitals, pharmacies, doctors, lab tests, fitness, wellness
  * "Utilities & Bills" -- Electricity, water, gas, internet, mobile/phone, broadband
  * "Travel" -- Flights, hotels, travel bookings, car rentals, railways
  * "Education" -- Tuition, courses, books, school/college fees, online learning
  * "Finance & Investment" -- Investments, trading, interest charges, annual fees, \
late payment fees, finance charges, and ONLY active EMI installments that explicitly show \
installment numbers (e.g., "EMI 3/12", "INST 5 OF 6"). \
**WARNING: Most "EMI" labels on statements just mean the purchase CAN be converted to EMI — \
they are regular purchases. Categorize by the merchant, NOT the EMI tag.**
  * "Transfers" -- Card payments, fund transfers, wallet top-ups, peer-to-peer transfers
  * "Other" -- Anything that does not clearly fit the above categories

"""

STATEMENT_PERIOD_RULES = """\
Also extract the **statement period** from the document header/summary section:
- statement_period_from: The start date of the billing cycle (YYYY-MM-DD)
- statement_period_to: The end date of the billing cycle (YYYY-MM-DD)
- Look for labels like "Statement Period", "Statement Date", "Billing Period", \
"From ... To ...", "Statement for the period" etc.
- If only a single statement date is found (no range), use it as statement_period_to \
and leave statement_period_from as null.
- If the period cannot be determined, leave both as null.

"""

CARD_METADATA_RULES = """\
Also extract **card metadata** from the statement header/summary section:
- card_last4: Last 4 digits of the card number (look for "XXXX XXXX XXXX 1234" or "Card ending 1234")
- card_network: Card network (Visa, Mastercard, American Express, RuPay, Discover)
- credit_limit: Total credit limit
- total_amount_due: The **full outstanding balance** for the billing cycle. This is the larger \
amount. Look for labels like "Total Amount Due", "Total Outstanding", "Total Due", \
"Statement Balance", "Current Balance", "Total Dues". This is NOT the minimum payment. \
It is always >= minimum_amount_due.
- minimum_amount_due: The **minimum payment** required to avoid late fees. This is the smaller \
amount. Look for labels like "Minimum Amount Due", "Min. Due", "MAD", "Minimum Payment Due". \
**CRITICAL: total_amount_due and minimum_amount_due are DIFFERENT values. Do NOT put the same \
number in both fields.** The total is the full balance; the minimum is a small fraction of it.
- payment_due_date: Payment due date in YYYY-MM-DD
- currency: Detect the ISO 4217 currency code. You MUST return one of: "INR", "USD", "EUR", "GBP".
- If any field cannot be determined from the text, leave it as null.

"""

FOOTER = """\
Skip headers, footers, totals, subtotals, summary rows, and non-transaction text.
If no transactions are found, return an empty list.
"""
