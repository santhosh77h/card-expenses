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
- Arrow markers: "\u2190" next to amount = credit
- Separate debit/credit amount columns: the column determines the type
- Some statements have a single amount column with Cr/Dr suffix

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

**EMI handling (Indian statements):**
Many Indian credit card statements show "EMI" next to a transaction. This usually \
means the purchase is **eligible for EMI conversion**, NOT that it is an actual EMI \
transaction. Categorize based on the merchant/description, not the EMI tag.
  - "Amazon.in EMI" \u2192 Shopping (regular purchase, EMI-eligible)
  - "Flipkart EMI" \u2192 Shopping
  - "Croma Electronics EMI" \u2192 Shopping
  - "Swiggy EMI" \u2192 Food & Dining

Only classify as "Finance & Investment" if the description explicitly indicates an \
active EMI installment, such as:
  - "EMI - 3/12", "EMI INSTALLMENT", "EMI DEBIT"
  - "LOAN EMI", "AUTO DEBIT EMI", "EMI CONVERSION"
  - Descriptions with installment numbers like "3 OF 12", "INST 5/6"

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

**Fees (Indian statements):**
- GST on fees, annual fee, late payment charge, finance charge, over-limit charge
- These are all DEBIT type, category "Finance & Investment"

**Card networks:** Visa, Mastercard, RuPay, American Express

"""
