"""
India-specific LLM prompt rules for credit card statement parsing.
"""

INDIA_RULES = """\
--- REGION-SPECIFIC RULES: INDIA ---

**Date formats (Indian statements):**
- DD/MM/YYYY, DD-Mon-YYYY (e.g., 15-Jan-2024), DD Mon YYYY (e.g., 15 Jan 2024)
- **NEVER interpret as MM/DD.** The first number is always the day.

**Currency:**
- INR, Rs., Rs, \u20b9. Default currency is "INR".
- Indian numbering system: lakhs and crores (e.g., 1,00,000 = one lakh, 1,00,00,000 = one crore).
  Parse these amounts correctly.

**Indian banks:**
- HDFC, ICICI, SBI, Axis, Kotak, Yes Bank, IndusInd, RBL, Federal, IDFC First, \
AU Small Finance, BOB (Bank of Baroda), Canara, PNB

**Credit/Debit identification (Indian statements):**
- Suffix markers: "Cr" or "CR" = credit, "Dr" or "DR" = debit
- **Plus prefix: "+" before the amount = credit** (refund, payment, reversal). \
No sign prefix = debit. This is common on HDFC, ICICI, and other Indian bank statements.
- Arrow markers: "\u2190" next to amount = credit
- Separate debit/credit amount columns: the column determines the type
- Some statements have a single amount column with Cr/Dr suffix
- Description keywords: "REVERSAL", "REFUND", "CREDIT", "REV PROC" in the description = credit

**Payment indicators (CREDIT type):**
- "BPPY CC PAYMENT", "CC PAYMENT", "CREDIT CARD PAYMENT"
- "NEFT CR", "NEFT CREDIT", "IMPS PAYMENT", "UPI PAYMENT", "RTGS"
- "PAYMENT RECEIVED", "ONLINE PAYMENT RECEIVED"

**IMPORTANT -- Merchant name confusion (Indian statements):**
- "TATA PAYMENTS LIMITED", "RAZORPAY PAYMENTS", "PAYTM PAYMENTS", \
"GOOGLE PAYMENTS INDIA" are **merchant/payment-processor names** -- these are PURCHASES \
(type = "debit"), NOT payments towards the card.
- Only classify as "credit" when the description explicitly indicates a card payment \
(e.g., "BPPY CC PAYMENT", "NEFT CR") or refund/cashback.

**EMI handling (Indian statements) -- CRITICAL, READ CAREFULLY:**
Indian credit card statements commonly print "EMI" next to transactions. \
In the vast majority of cases this is a **marketing label** meaning the purchase \
is eligible for EMI conversion. It is NOT an active EMI. Treat it as a **regular purchase**.

  Step 1: IGNORE the "EMI" tag entirely when choosing the category.
  Step 2: REMOVE "EMI" from the description -- it is not part of the merchant name.
  Step 3: Categorize purely by the merchant/description.

  Examples -- these are all REGULAR PURCHASES, NOT Finance & Investment:
  - "Amazon.in EMI" -> description: "Amazon.in", category: Shopping
  - "Flipkart EMI" -> description: "Flipkart", category: Shopping
  - "Croma Electronics EMI" -> description: "Croma Electronics", category: Shopping
  - "Swiggy EMI" -> description: "Swiggy", category: Food & Dining
  - "APPLE STORE EMI" -> description: "Apple Store", category: Shopping
  - "MakeMyTrip EMI" -> description: "MakeMyTrip", category: Travel

  The ONLY time you classify as "Finance & Investment" is when the description \
explicitly contains an **installment number** proving it is an active EMI debit:
  - "EMI - 3/12" or "EMI 3 OF 12" (has installment counter)
  - "EMI INSTALLMENT", "EMI DEBIT", "AUTO DEBIT EMI"
  - "LOAN EMI", "EMI CONVERSION"
  - Pattern: any text with "N/M" or "INST N OF M" where N and M are numbers

  If there is no installment number, it is NOT an active EMI -- categorize by merchant.

**Foreign transactions (Indian cards):**
- Extract the INR billed amount, NOT the original foreign currency amount.
- Foreign transactions may show both amounts -- always use the INR line.

**Common Indian merchants (for categorization hints):**
- Food: Swiggy, Zomato, BigBasket (delivery), Haldirams, Barbeque Nation
- Shopping: Amazon.in, Flipkart, Myntra, Ajio, Meesho, Nykaa, Croma, Vijay Sales
- Transport: Ola, Rapido, IRCTC, FASTag
- Bills: Jio, Airtel, Vi, Tata Sky
- Transfers: Google Pay, PhonePe, Paytm, CRED

**Statement sections to identify:**
- "Account Summary", "Reward Points Summary", "Transaction Details", "Payment Due Date"
- "Total Amount Due", "Minimum Amount Due", "Credit Limit", "Available Credit"

**Total vs Minimum Amount Due (Indian statements) -- IMPORTANT:**
Indian statements always show TWO separate due amounts. They are NOT the same:
  - total_amount_due = "Total Amount Due" / "Total Dues" / "Total Outstanding" \
(the full balance, usually a large number)
  - minimum_amount_due = "Minimum Amount Due" / "Min Amount Due" / "MAD" \
(a small fraction, typically 5% of total or a fixed minimum like Rs 200)
  These are always different. If you find only one value, it is likely the total. \
Do NOT copy the minimum into the total field.

**Total Amount Due vs Total Credits/Debits (Indian statements) -- CRITICAL:**
Indian statements show a "Transaction Summary" or "Domestic/International Transactions" section \
with subtotals like "Total Debits" and "Total Credits". These are transaction CATEGORY TOTALS, \
NOT the amount due:
  - "Total Credits" / "Total Refunds" = sum of all refund/cashback/payment transactions. \
This is NOT total_amount_due.
  - "Total Debits" / "Total Purchases" = sum of all purchase/charge transactions. \
This is NOT total_amount_due.
  - total_amount_due is the NET balance from the "Account Summary" or "Payment Due" box, \
usually labeled "Total Amount Due" or "Total Dues". It is calculated as: \
previous balance + total debits - total credits + fees/interest. \
It is typically close to (previous_balance + total_debits - total_credits). \
It is NOT equal to any single transaction subtotal or the minimum due.
  Do NOT use transaction subtotals as total_amount_due.
  - **HDFC Bank specifically:** The account summary shows a formula like \
"Previous Dues − Payments/Credits + Purchases/Debit + Finance Charges = Total Amount Due". \
Extract the FINAL result ("Total Amount Due"), NOT the "Purchases/Debit (Current Billing Cycle)" \
component — those are different values.

**Fees (Indian statements):**
- GST on fees, annual fee, late payment charge, finance charge, over-limit charge
- These are all DEBIT type, category "Finance & Investment"

**Transaction type hints (Indian statements):**
- EMI lifecycle entries: "OFFUS EMI", "EMI CONVERSION", "LOAN CANCL", \
"AGGREGATOR EMI" → transaction_type="emi"
- Fee entries: "PROCNG FEE", "PROCESSING FEE", "ANNUAL FEE" → transaction_type="fee"
- Tax entries: "IGST", "CGST", "SGST", "GST ON" → transaction_type="tax"
- Reversal entries: "REV PROC", "GST REVERSAL", "FEE REVERSAL" → transaction_type="reversal"
- Payment entries: "BPPY CC PAYMENT", "NEFT CR" → transaction_type="payment"
- A purchase with "EMI" label is still transaction_type="purchase" — \
only actual EMI lifecycle entries are "emi".

**Card networks:** Visa, Mastercard, RuPay, American Express

"""
