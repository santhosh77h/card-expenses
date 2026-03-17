"""
End-to-end test of the Vector NLU pipeline.

Loads both TFLite models (intent + entity) and simulates the full
query → structured output → SQL pipeline.

Usage:
    cd ml
    python test_pipeline.py
"""

import json
import re
import numpy as np
import tensorflow as tf
from training_data import CATEGORY_CANONICAL, CARD_CANONICAL

OUTPUT_DIR = "output"
SEQUENCE_LENGTH = 20


def load_json(path):
    with open(path) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Load models and metadata
# ---------------------------------------------------------------------------
print("Loading models...")

# Intent model
intent_interpreter = tf.lite.Interpreter(
    model_path=f"{OUTPUT_DIR}/intent_model.tflite"
)
intent_interpreter.allocate_tensors()
intent_input = intent_interpreter.get_input_details()
intent_output = intent_interpreter.get_output_details()
intent_labels = load_json(f"{OUTPUT_DIR}/intent_labels.json")
intent_vocab = load_json(f"{OUTPUT_DIR}/intent_vocab.json")

# Entity model
entity_interpreter = tf.lite.Interpreter(
    model_path=f"{OUTPUT_DIR}/entity_model.tflite"
)
entity_interpreter.allocate_tensors()
entity_input = entity_interpreter.get_input_details()
entity_output = entity_interpreter.get_output_details()
entity_labels = load_json(f"{OUTPUT_DIR}/entity_labels.json")
entity_vocab = load_json(f"{OUTPUT_DIR}/entity_vocab.json")

print("Models loaded!\n")


# ---------------------------------------------------------------------------
# Inference functions
# ---------------------------------------------------------------------------
def text_to_seq(text, vocab, max_len=SEQUENCE_LENGTH):
    words = text.lower().split()
    seq = [vocab.get(w, 1) for w in words[:max_len]]
    seq += [0] * (max_len - len(seq))
    return np.array([seq], dtype=np.int32)


def predict_intent(text):
    seq = text_to_seq(text, intent_vocab)
    intent_interpreter.set_tensor(intent_input[0]["index"], seq)
    intent_interpreter.invoke()
    output = intent_interpreter.get_tensor(intent_output[0]["index"])[0]
    idx = np.argmax(output)
    return intent_labels[idx], float(output[idx])


def predict_entities(text):
    words = text.lower().split()
    seq = text_to_seq(text, entity_vocab)
    entity_interpreter.set_tensor(entity_input[0]["index"], seq)
    entity_interpreter.invoke()
    output = entity_interpreter.get_tensor(entity_output[0]["index"])[0]

    entities = {}
    current_entity = None
    current_words = []

    for i, word in enumerate(words[:SEQUENCE_LENGTH]):
        tag_id = np.argmax(output[i])
        tag = entity_labels[tag_id]

        if tag.startswith("B-"):
            if current_entity and current_words:
                entities[current_entity.lower()] = " ".join(current_words)
            current_entity = tag[2:]
            current_words = [word]
        elif tag.startswith("I-") and current_entity == tag[2:]:
            current_words.append(word)
        else:
            if current_entity and current_words:
                entities[current_entity.lower()] = " ".join(current_words)
            current_entity = None
            current_words = []

    if current_entity and current_words:
        entities[current_entity.lower()] = " ".join(current_words)

    return entities


# ---------------------------------------------------------------------------
# SQL generation (simulates what the mobile app would do)
# ---------------------------------------------------------------------------
def entities_to_sql(intent, entities):
    """Convert intent + entities into a SQL query for the transactions table."""
    conditions = []
    params = []

    # Merchant filter
    if "merchant" in entities:
        conditions.append("description LIKE ?")
        params.append(f"%{entities['merchant']}%")

    # Category filter
    if "category" in entities:
        cat = entities["category"]
        canonical = CATEGORY_CANONICAL.get(cat, cat)
        conditions.append("category = ?")
        params.append(canonical)

    # Amount filter
    if "amount" in entities:
        amount_str = entities["amount"]
        numbers = re.findall(r"\d+", amount_str)
        if numbers:
            num = int(numbers[0])
            if any(kw in amount_str for kw in ["above", "over", "more", "greater"]):
                conditions.append("amount > ?")
                params.append(num)
            elif any(kw in amount_str for kw in ["below", "under", "less"]):
                conditions.append("amount < ?")
                params.append(num)

    # Card filter
    if "card" in entities:
        card_text = entities["card"]
        # Strip trailing "card", "credit card", "debit card"
        cleaned = re.sub(r"\s*(credit|debit)?\s*card$", "", card_text).strip()
        canonical = CARD_CANONICAL.get(cleaned, cleaned.upper())
        # In real app this resolves to cardId UUID; here we use issuer name
        conditions.append(f"/* card: {canonical} → cardId = ? */")

    # Date filter (simplified — mobile app would resolve "yesterday" etc.)
    if "date" in entities:
        date_val = entities["date"]
        # Just show placeholder; real app resolves relative dates
        conditions.append(f"/* date: {date_val} */")

    where = " AND ".join(conditions) if conditions else "1=1"

    # Build query based on intent
    if intent == "count_transactions":
        sql = f"SELECT COUNT(*) FROM transactions WHERE {where}"
    elif intent == "total_spent":
        sql = f"SELECT SUM(amount) FROM transactions WHERE type='debit' AND {where}"
    elif intent == "list_transactions":
        sql = f"SELECT * FROM transactions WHERE {where} ORDER BY date DESC LIMIT 20"
    elif intent == "highest_transaction":
        sql = f"SELECT * FROM transactions WHERE type='debit' AND {where} ORDER BY amount DESC LIMIT 1"
    elif intent == "lowest_transaction":
        sql = f"SELECT * FROM transactions WHERE type='debit' AND {where} ORDER BY amount ASC LIMIT 1"
    elif intent == "average_spend":
        sql = f"SELECT AVG(amount) FROM transactions WHERE type='debit' AND {where}"
    elif intent == "category_spend":
        sql = f"SELECT category, SUM(amount), COUNT(*) FROM transactions WHERE type='debit' AND {where} GROUP BY category"
    elif intent == "transactions_on_date":
        sql = f"SELECT * FROM transactions WHERE {where} ORDER BY date DESC"
    elif intent == "monthly_summary":
        sql = f"SELECT strftime('%Y-%m', date) as month, SUM(amount), COUNT(*) FROM transactions WHERE type='debit' AND {where} GROUP BY month"
    else:
        sql = f"SELECT * FROM transactions WHERE {where}"

    return sql, params


# ---------------------------------------------------------------------------
# Run test queries
# ---------------------------------------------------------------------------
test_queries = [
    "how many swiggy transactions",
    "how much did I spend on food",
    "what did I spend yesterday",
    "total spent on zomato this month",
    "amazon orders above 500",
    "show my grocery spending",
    "what was my biggest expense",
    "average spending on uber",
    "list netflix payments",
    "monthly summary",
    "how many transactions last month",
    "total shopping expenses this week",
    # Card queries
    "show sbi card transactions",
    "how much did I spend on hdfc card",
    "hdfc card food expenses this month",
    "biggest expense on icici card",
    "sbi card transactions last month",
    "average spending on axis card",
    "how many kotak card transactions",
    # Card + Merchant queries
    "my swiggy transactions in sbi card",
    "uber rides on hdfc card",
    "amazon orders from my icici card",
    # Card + Merchant + Date queries
    "my swiggy transactions in january with sbi card",
    "zomato orders last month on hdfc card",
    "uber rides this week from icici card",
]

print("=" * 70)
print("VECTOR NLU PIPELINE — End-to-End Test")
print("=" * 70)

for query in test_queries:
    intent, confidence = predict_intent(query)
    entities = predict_entities(query)
    sql, params = entities_to_sql(intent, entities)

    print(f"\n  Query: \"{query}\"")
    print(f"  Intent: {intent} ({confidence:.0%})")
    print(f"  Entities: {json.dumps(entities) if entities else '(none)'}")
    print(f"  SQL: {sql}")
    if params:
        print(f"  Params: {params}")
    print(f"  ---")

print("\n\nPipeline test complete!")
print(f"Intent model: {OUTPUT_DIR}/intent_model.tflite")
print(f"Entity model: {OUTPUT_DIR}/entity_model.tflite")
