"""
US-specific LLM prompt rules for credit card statement parsing.
"""

US_RULES = """\
--- REGION-SPECIFIC RULES: UNITED STATES ---

**Date formats (US statements):**
- MM/DD/YYYY, MM/DD/YY, MM/DD (year inferred from statement period)
- **The first number is always the month, NOT the day.**

**Currency:**
- USD, $. Standard Western numbering (1,000,000.00).
- Default currency is "USD".

**US banks:**
- Chase, Citi, Bank of America, Wells Fargo, Capital One, Discover, Amex, \
US Bank, Synchrony, PNC, TD Bank, USAA, Barclays US

**Credit/Debit identification (US statements):**
- Negative amounts: -$25.00 or ($25.00) in parentheses = credit
- Separate "Payments and Credits" / "Payments and Other Credits" section = credits
- "Account Activity" or "Transactions" section = mostly debits
- Some statements use a single amount column where negative = credit

**Payment indicators (CREDIT type):**
- "PAYMENT - THANK YOU", "PAYMENT THANK YOU"
- "ONLINE PAYMENT", "AUTOPAY PAYMENT", "AUTOMATIC PAYMENT", "MOBILE PAYMENT"
- "ACH PAYMENT", "ELECTRONIC PAYMENT"

**Description cleaning (US statements):**
- US transactions often include city/state: "STARBUCKS #12345 SEATTLE WA" \
-- clean to just "Starbucks"
- Remove store numbers (#12345), terminal IDs, and location suffixes
- "SQ *" prefix = Square merchant, strip the prefix
- "TST*" prefix = Toast restaurant POS, strip the prefix
- "PAYPAL *" prefix = PayPal merchant, strip the prefix

**Foreign transactions (US cards):**
- Extract the USD billed amount, NOT the original foreign currency.
- "Foreign Transaction Fee" line items are DEBIT type, category "Finance & Investment"

**Common US merchants (for categorization hints):**
- Food: DoorDash, Grubhub, Uber Eats, Chipotle, Chick-fil-A, Starbucks, \
Taco Bell, Wendy's, Panera, Shake Shack, Panda Express, Chili's, Applebee's, IHOP
- Groceries: Walmart, Kroger, Whole Foods, Trader Joe's, Safeway, Publix, \
Aldi, Instacart, Target (grocery)
- Shopping: Amazon.com, Target, Best Buy, Home Depot, Lowe's, Macy's, \
Nordstrom, TJ Maxx, Marshalls, Etsy, Wayfair
- Transport: Uber, Lyft, Exxon, Chevron, Sunoco, EZ Pass, FasTrak
- Entertainment: Netflix, Hulu, Peacock, Paramount+, HBO Max, AMC, Fandango, \
Disney+, Spotify, Apple Music
- Health: CVS, Walgreens, Rite Aid, Kaiser, Planet Fitness, Peloton
- Bills: Comcast, Xfinity, Verizon, T-Mobile, Spectrum, AT&T, Duke Energy
- Travel: Delta, United, American Airlines, Southwest, JetBlue, Marriott, \
Hilton, Expedia, Hertz
- Finance: Robinhood, Fidelity, Schwab, Vanguard, Coinbase, SoFi
- Transfers: Venmo, Zelle, Cash App, Apple Cash

**Statement sections to identify:**
- "Billing Period", "Account Activity", "Payment Information", \
"Interest Charges", "Fees Charged", "Rewards Summary"
- "New Balance", "Previous Balance", "Payments and Credits"

**APR sections:**
- Multiple APR tiers (purchases, cash advances, balance transfers) \
-- SKIP these rows, they are not transactions.
- "Interest Charge Calculation" sections are informational -- skip.

**Fees (US statements):**
- Annual fee, interest charges, foreign transaction fee, late fee, \
returned payment fee, cash advance fee, balance transfer fee
- These are all DEBIT type, category "Finance & Investment"

**Card networks:** Visa, Mastercard, American Express, Discover

"""
