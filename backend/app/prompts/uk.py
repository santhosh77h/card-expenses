"""
UK-specific LLM prompt rules for credit card statement parsing.
"""

UK_RULES = """\
--- REGION-SPECIFIC RULES: UNITED KINGDOM ---

**Date formats (UK statements):**
- DD/MM/YYYY, DD Mon YYYY (e.g., 15 Jan 2024), DD-Mon-YY (e.g., 15-Jan-24)
- **NEVER interpret as MM/DD.** The first number is always the day (same as India, NOT US).

**Currency:**
- GBP, \u00a3. Standard Western numbering (1,000,000.00).
- Default currency is "GBP".

**UK banks:**
- Barclays/Barclaycard, HSBC, NatWest, Lloyds, Santander UK, Halifax, \
Nationwide, Virgin Money, Tesco Bank, M&S Bank, John Lewis Financial Services, \
Metro Bank, Monzo, Starling

**Credit/Debit identification (UK statements):**
- Some banks use Cr/Dr suffixes (like India)
- Some banks use negative amounts (like US)
- Some banks have a separate "Credits" section
- Check for all three patterns

**Payment indicators (CREDIT type):**
- "PAYMENT RECEIVED", "PAYMENT RECEIVED - THANK YOU"
- "DIRECT DEBIT PAYMENT", "DD PAYMENT"
- "FASTER PAYMENT", "FP PAYMENT"
- "BACS PAYMENT", "STANDING ORDER"
- "BANK TRANSFER"

**Description cleaning (UK statements):**
- "CONTACTLESS" prefix on tap-to-pay transactions -- strip this prefix
- "CHIP & PIN" or "CHIP AND PIN" prefix -- strip this prefix
- Remove transaction reference numbers and terminal IDs

**Foreign transactions (UK cards):**
- Original currency + GBP equivalent shown. Extract the GBP amount.
- "Foreign usage fee" (not "foreign transaction fee") line items are DEBIT, \
category "Finance & Investment"

**Common UK merchants (for categorization hints):**
- Food: Deliveroo, Just Eat, Nando's, Greggs, Pret A Manger, Wagamama, \
Costa Coffee, Wetherspoon, McDonald's, KFC, Subway
- Groceries: Tesco, Sainsbury's, ASDA, Waitrose, Ocado, Lidl, Aldi, \
Morrisons, Co-op, Iceland, M&S Food
- Shopping: Primark, John Lewis, Argos, Next, ASOS, TK Maxx, Selfridges, \
Currys, Amazon.co.uk, Boots (non-pharmacy)
- Transport: TfL (Transport for London), Oyster, Trainline, National Rail, \
Bolt, Addison Lee, Esso, BP, Shell, Dart Charge
- Entertainment: Sky TV, NOW TV, BritBox, Odeon, Cineworld, Vue, \
Netflix, Spotify, Disney+, BBC (licence fee is Utilities)
- Health: Boots (pharmacy), Superdrug, Lloyds Pharmacy, Bupa, PureGym, \
Specsavers, David Lloyd
- Bills: BT, Virgin Media, Three, EE, Vodafone UK, British Gas, \
Octopus Energy, Thames Water, Council Tax, TV Licence
- Travel: British Airways, easyJet, Ryanair, Jet2, Premier Inn, \
Travelodge, Eurostar, National Express, Booking.com
- Finance: Hargreaves Lansdown, Trading 212, Freetrade, Nutmeg, Moneybox
- Transfers: Faster Payment, BACS, CHAPS, Standing Order, Wise, Revolut

**Statement sections to identify:**
- "Statement Date", "Minimum Payment", "Transaction Details", \
"Interest Summary", "Payment Due Date"
- "Statement Balance", "Previous Balance", "Payments Received"

**UK-specific notes:**
- APRC (Annual Percentage Rate of Charge) sections -- skip, not transactions
- PPI (Payment Protection Insurance) references -- skip, historical
- "Chip & PIN" references are just payment method indicators, not transactions

**Fees (UK statements):**
- Interest charges, cash advance fee, late payment fee, over-limit fee, \
foreign usage fee, annual fee
- These are all DEBIT type, category "Finance & Investment"

**Card networks:** Visa, Mastercard, American Express

"""
