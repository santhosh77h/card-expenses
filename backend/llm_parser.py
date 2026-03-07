"""
LLM-powered PDF transaction parser for Cardlytics.

Uses OpenAI structured output to extract and categorize transactions
from raw PDF text in a single call. Falls back gracefully when the
API key is missing, the package isn't installed, or the call fails.
"""

import json
import logging
import os
from typing import Literal, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic models for structured output
# ---------------------------------------------------------------------------

class LLMTransaction(BaseModel):
    date: str = Field(description="Transaction date in YYYY-MM-DD format")
    description: str = Field(description="Transaction description/merchant name")
    amount: float = Field(description="Transaction amount as a positive number")
    type: Literal["debit", "credit"]
    category: str = Field(description="Spending category from the allowed list")


class LLMCardInfo(BaseModel):
    card_last4: Optional[str] = Field(default=None, description="Last 4 digits of the credit card number as printed on the statement")
    card_network: Optional[str] = Field(default=None, description="Card network: Visa, Mastercard, American Express, or RuPay")
    credit_limit: Optional[float] = Field(default=None, description="Total credit limit on the card, if printed")
    total_amount_due: Optional[float] = Field(default=None, description="Total amount due / outstanding for this billing cycle")
    minimum_amount_due: Optional[float] = Field(default=None, description="Minimum amount due for this billing cycle, if printed")
    payment_due_date: Optional[str] = Field(default=None, description="Payment due date in YYYY-MM-DD format, if printed")
    currency: Optional[str] = Field(default=None, description="ISO 4217 currency code detected from the statement, e.g. INR, USD, EUR, GBP")


class LLMExtractionResult(BaseModel):
    transactions: list[LLMTransaction]
    statement_period_from: Optional[str] = Field(
        default=None,
        description="Statement period start date in YYYY-MM-DD format, as printed on the document",
    )
    statement_period_to: Optional[str] = Field(
        default=None,
        description="Statement period end date in YYYY-MM-DD format, as printed on the document",
    )
    card_info: LLMCardInfo = Field(default_factory=LLMCardInfo)


# ---------------------------------------------------------------------------
# Category metadata — mirrors categorizer.py (color + icon only)
# ---------------------------------------------------------------------------

CATEGORY_META: dict[str, dict[str, str]] = {
    "Food & Dining": {"color": "#FF6B6B", "icon": "fork-knife"},
    "Groceries": {"color": "#4ADE80", "icon": "shopping-cart"},
    "Shopping": {"color": "#60A5FA", "icon": "shopping-bag"},
    "Transportation": {"color": "#34D399", "icon": "car"},
    "Entertainment": {"color": "#A78BFA", "icon": "film"},
    "Health & Medical": {"color": "#FFB547", "icon": "heart-pulse"},
    "Utilities & Bills": {"color": "#F472B6", "icon": "zap"},
    "Travel": {"color": "#22D3EE", "icon": "plane"},
    "Education": {"color": "#818CF8", "icon": "book-open"},
    "Finance & Investment": {"color": "#FBBF24", "icon": "trending-up"},
    "Transfers": {"color": "#94A3B8", "icon": "repeat"},
    "Other": {"color": "#6B7280", "icon": "file-text"},
}

ALLOWED_CATEGORIES = list(CATEGORY_META.keys())

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = f"""\
You are a financial document parser. Extract ALL transactions from the provided \
bank/credit card statement text and categorize each one.

Rules:
- date: Convert to YYYY-MM-DD. Indian banks use DD/MM/YYYY or DD-Mon-YYYY. \
US banks use MM/DD/YYYY.
- description: Clean merchant/payee name. Remove reference numbers and noise.
- amount: Always a positive float. Strip currency symbols and commas.
- type: Classify as "debit" or "credit" using these rules:

  CREDIT (type = "credit") — any transaction that REDUCES the outstanding balance:
    • Payments made towards the card: "CC PAYMENT", "BPPY CC PAYMENT", "CREDIT CARD PAYMENT"
    • NEFT / IMPS / UPI / RTGS payments received by the card account
    • "PAYMENT RECEIVED", "PAYMENT THANK YOU", "PAYMENT - THANK YOU"
    • Cashback: "CASHBACK", "CASH BACK", "CB CREDIT"
    • Refunds: "REFUND", "REVERSAL", "CREDIT ADJUSTMENT", "DISPUTE CREDIT"
    • Any row with a "Cr" or "CR" suffix/marker or a "←" arrow next to the amount

  DEBIT (type = "debit") — any transaction that INCREASES the outstanding balance:
    • Purchases, POS transactions, online spends
    • Fees, interest, late payment charges, annual fees
    • Cash advances, balance transfers
    • Any row with a "Dr" or "DR" suffix/marker

  **IMPORTANT — Do NOT confuse merchant names with payment indicators:**
  Company names like "TATA PAYMENTS LIMITED", "GOOGLE PAYMENTS", "RAZORPAY PAYMENTS", \
"PAYTM PAYMENTS" are **merchant/payment-processor names** — transactions to these are \
PURCHASES (type = "debit"), not payments towards the card.
  Only classify as "credit" when the description explicitly indicates a card payment \
(e.g., "BPPY CC PAYMENT", "NEFT CR", "IMPS PAYMENT RECEIVED") or refund/cashback.
  When in doubt, default to "debit" — most transactions on a credit card statement are purchases.

  On Indian credit card statements, any payment made TOWARDS the card \
(reducing outstanding balance) is a CREDIT. Purchases and charges are DEBITS.
  If the statement has separate debit/credit amount columns, the column in which \
the amount appears determines the type.

**Important — EMI labels on Indian credit card statements:**
Many Indian credit card statements show "EMI" next to a transaction. This usually \
means the purchase is **eligible for EMI conversion**, NOT that it is an actual EMI \
transaction. Categorize based on the merchant/description, not the EMI tag.
  - "Amazon.in EMI" → Shopping (regular Amazon purchase, EMI-eligible)
  - "Flipkart EMI" → Shopping
  - "Croma Electronics EMI" → Shopping
  - "Swiggy EMI" → Food & Dining

Only classify as "Finance & Investment" if the description explicitly indicates an \
active EMI installment, such as:
  - "EMI - 3/12", "EMI INSTALLMENT", "EMI DEBIT"
  - "LOAN EMI", "AUTO DEBIT EMI", "EMI CONVERSION"
  - Descriptions with installment numbers like "3 OF 12", "INST 5/6"

- category: You MUST assign exactly one category from the list below. Do NOT invent new \
categories. Pick the best match; use "Other" only if nothing else fits.

  Categories and what belongs in each:
  • "Food & Dining" — Restaurants, cafes, Zomato, Swiggy, food delivery, dining out
  • "Groceries" — Supermarkets, BigBasket, Blinkit, DMart, grocery stores, kirana
  • "Shopping" — Amazon, Flipkart, Myntra, retail stores, clothing, electronics, online shopping
  • "Transportation" — Uber, Ola, auto, taxi, metro, bus, fuel, petrol, parking, toll, FASTag
  • "Entertainment" — Netflix, Hotstar, Spotify, movies, gaming, BookMyShow, subscriptions
  • "Health & Medical" — Hospitals, pharmacies, doctors, lab tests, insurance premiums, Apollo, 1mg
  • "Utilities & Bills" — Electricity, water, gas, internet, mobile recharge, broadband, Jio, Airtel
  • "Travel" — Flights, hotels, MakeMyTrip, IRCTC, railways, Booking.com, Airbnb, travel bookings
  • "Education" — Tuition, courses, Udemy, books, school/college fees, coaching
  • "Finance & Investment" — Mutual funds, SIP, stock trading, active EMI installments \
(with installment numbers like "EMI - 3/12"), insurance, interest charges, \
annual fees, late payment fees, finance charges. Do NOT put EMI-eligible purchases here.
  • "Transfers" — CC payments (BPPY, NEFT, IMPS, UPI payments to card), fund transfers, \
wallet top-ups, PayTM, PhonePe transfers
  • "Other" — Anything that does not clearly fit the above categories

Also extract the **statement period** from the document header/summary section:
- statement_period_from: The start date of the billing cycle (YYYY-MM-DD)
- statement_period_to: The end date of the billing cycle (YYYY-MM-DD)
- Look for labels like "Statement Period", "Statement Date", "Billing Period", \
"From ... To ...", "Statement for the period" etc.
- If only a single statement date is found (no range), use it as statement_period_to \
and leave statement_period_from as null.
- If the period cannot be determined, leave both as null.

Also extract **card metadata** from the statement header/summary section:
- card_last4: Last 4 digits of the card number (look for "XXXX XXXX XXXX 1234" or "Card ending 1234" or "Card No: ...1234")
- card_network: Card network (Visa, Mastercard, American Express, RuPay) — look for logos or text mentions
- credit_limit: Total credit limit (look for "Credit Limit", "Total Credit Limit", "Cash + Credit Limit")
- total_amount_due: Total outstanding/due (look for "Total Amount Due", "Total Due", "Statement Balance", "Total Outstanding")
- minimum_amount_due: Minimum payment due (look for "Minimum Amount Due", "Min Due", "MAD")
- payment_due_date: Payment due date in YYYY-MM-DD (look for "Due Date", "Payment Due Date", "Pay By")
- currency: **IMPORTANT** — Detect the ISO 4217 currency code used in this statement. \
This is critical for multi-currency support. Analyze:
  1. Currency symbols next to amounts: \u20B9 or "Rs." or "Rs " or "INR" → "INR", \
"$" or "USD" → "USD", \u20AC or "EUR" → "EUR", \u00A3 or "GBP" → "GBP"
  2. Bank identity: Indian banks (HDFC, ICICI, SBI, Axis, Kotak, Yes Bank, IndusInd, \
RBL, Federal, IDFC) → "INR"; US banks (Chase, Citi, Bank of America, Wells Fargo, \
Capital One, Discover) → "USD"; UK banks (Barclays, HSBC UK, NatWest, Lloyds) → "GBP"
  3. Country/locale indicators in the statement header or footer
  You MUST return one of: "INR", "USD", "EUR", "GBP". Default to "INR" only if \
no other currency indicators are found.
- If any field cannot be determined from the text, leave it as null.

Skip headers, footers, totals, subtotals, summary rows, and non-transaction text.
If no transactions are found, return an empty list.
"""

MAX_TEXT_LENGTH = 100_000


# ---------------------------------------------------------------------------
# Main function
# ---------------------------------------------------------------------------

def llm_parse_transactions(
    text: str, bank_hint: str = "generic"
) -> Optional[dict]:
    """
    Parse transactions from PDF text using OpenAI structured output.

    Returns a dict with keys ``transactions`` (list[dict]) and
    ``statement_period`` (dict with 'from'/'to'), or None if the
    LLM path is unavailable or fails.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.debug("OPENAI_API_KEY not set — skipping LLM parser")
        return None

    try:
        from openai import OpenAI
    except ImportError:
        logger.warning("openai package not installed — skipping LLM parser")
        return None

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    truncated_text = text[:MAX_TEXT_LENGTH]

    user_message = (
        f"Bank detected: {bank_hint}\n\n"
        f"--- STATEMENT TEXT ---\n{truncated_text}"
    )

    # --- Log LLM input ---
    logger.info("=" * 60)
    logger.info("LLM INPUT — model=%s, bank_hint=%s", model, bank_hint)
    logger.info("User message length: %d chars", len(user_message))
    logger.info("--- USER MESSAGE START ---\n%s", user_message[:5000])
    if len(user_message) > 5000:
        logger.info("... (truncated, full length: %d chars)", len(user_message))
    logger.info("--- USER MESSAGE END ---")

    try:
        client = OpenAI(api_key=api_key, timeout=45.0)
        completion = client.beta.chat.completions.parse(
            model=model,
            temperature=0.0,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            response_format=LLMExtractionResult,
        )

        result = completion.choices[0].message.parsed

        # --- Log raw LLM output ---
        raw_content = completion.choices[0].message.content
        logger.info("--- LLM RAW OUTPUT START ---\n%s", raw_content)
        logger.info("--- LLM RAW OUTPUT END ---")

        if result is None or not result.transactions:
            logger.warning("LLM returned no transactions")
            return None

        transactions: list[dict] = []
        for tx in result.transactions:
            meta = CATEGORY_META.get(tx.category, CATEGORY_META["Other"])
            transactions.append({
                "date": tx.date,
                "description": tx.description,
                "amount": tx.amount,
                "type": tx.type,
                "category": tx.category if tx.category in CATEGORY_META else "Other",
                "category_color": meta["color"],
                "category_icon": meta["icon"],
            })

        statement_period = {
            "from": result.statement_period_from,
            "to": result.statement_period_to,
        }

        # --- Log parsed transactions summary ---
        logger.info("LLM extracted %d transactions (model=%s):", len(transactions), model)
        for i, tx in enumerate(transactions):
            logger.info(
                "  [%d] %s | %s | %s | ₹%.2f | %s",
                i + 1, tx["date"], tx["type"], tx["description"], tx["amount"], tx["category"],
            )
        logger.info("Statement period: %s", json.dumps(statement_period))

        card_info = {
            "card_last4": result.card_info.card_last4,
            "card_network": result.card_info.card_network,
            "credit_limit": result.card_info.credit_limit,
            "total_amount_due": result.card_info.total_amount_due,
            "minimum_amount_due": result.card_info.minimum_amount_due,
            "payment_due_date": result.card_info.payment_due_date,
            "currency": result.card_info.currency,
        }
        logger.info("Card info: %s", json.dumps(card_info))
        logger.info("=" * 60)

        return {"transactions": transactions, "statement_period": statement_period, "card_info": card_info}

    except Exception:
        logger.warning("LLM parsing failed — falling back to regex", exc_info=True)
        return None
