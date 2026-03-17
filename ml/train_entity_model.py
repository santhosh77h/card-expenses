"""
Train a TensorFlow Lite entity (NER) model for Vector expense app.

Extracts: MERCHANT, CATEGORY, DATE, AMOUNT from user queries.
Uses BIO tagging (Begin/Inside/Outside) at word level.

Produces: output/entity_model.tflite + output/entity_labels.json + output/entity_vocab.json

Usage:
    cd ml
    python train_entity_model.py
"""

import json
import os
import re
import numpy as np
import tensorflow as tf
from training_data import (
    ENTITY_EXAMPLES,
    KNOWN_MERCHANTS,
    KNOWN_CATEGORIES,
    KNOWN_CARDS,
    INTENT_EXAMPLES,
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MAX_TOKENS = 2000
SEQUENCE_LENGTH = 20
EMBEDDING_DIM = 64
HIDDEN_DIM = 64
EPOCHS = 150
BATCH_SIZE = 16
OUTPUT_DIR = "output"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# 1. Define BIO tag set
# ---------------------------------------------------------------------------
ENTITY_TYPES = ["MERCHANT", "CATEGORY", "DATE", "AMOUNT", "CARD"]

# BIO tags: O, B-MERCHANT, I-MERCHANT, B-CATEGORY, I-CATEGORY, ...
tag_names = ["O"]
for etype in ENTITY_TYPES:
    tag_names.append(f"B-{etype}")
    tag_names.append(f"I-{etype}")

tag_to_id = {tag: i for i, tag in enumerate(tag_names)}
num_tags = len(tag_names)
print(f"Tags ({num_tags}): {tag_names}")

# ---------------------------------------------------------------------------
# 2. Convert char-level annotations to word-level BIO tags
# ---------------------------------------------------------------------------


def annotate_to_bio(text, char_entities):
    """Convert (start, end, type) char spans to word-level BIO tags."""
    words = text.lower().split()
    tags = ["O"] * len(words)

    # Build char-to-word mapping
    char_pos = 0
    word_spans = []
    for word in words:
        start = text.lower().index(word, char_pos)
        word_spans.append((start, start + len(word)))
        char_pos = start + len(word)

    for ent_start, ent_end, ent_type in char_entities:
        first_word = True
        for wi, (ws, we) in enumerate(word_spans):
            # Word overlaps with entity span
            if ws < ent_end and we > ent_start:
                if first_word:
                    tags[wi] = f"B-{ent_type}"
                    first_word = False
                else:
                    tags[wi] = f"I-{ent_type}"

    return words, tags


# ---------------------------------------------------------------------------
# 3. Generate more training data by augmentation
# ---------------------------------------------------------------------------
# We supplement the hand-annotated examples with auto-generated ones

def generate_augmented_examples():
    """Generate additional entity-annotated training data from templates."""
    templates_merchant = [
        "how many {merchant} transactions",
        "total spent on {merchant}",
        "count {merchant} orders",
        "show {merchant} transactions",
        "{merchant} expenses",
        "{merchant} payments",
        "how much on {merchant}",
        "list {merchant} purchases",
        "{merchant} orders this month",
        "how many {merchant} orders last month",
    ]

    templates_category = [
        "how much on {category}",
        "total {category} spending",
        "{category} expenses",
        "show {category} transactions",
        "{category} costs this month",
        "how much did I spend on {category}",
    ]

    augmented = []

    # Merchant examples
    for merchant in KNOWN_MERCHANTS[:30]:  # Use top 30
        for template in templates_merchant:
            text = template.format(merchant=merchant)
            start = text.index(merchant)
            end = start + len(merchant)
            augmented.append((text, [(start, end, "MERCHANT")]))

    # Category examples
    for category in KNOWN_CATEGORIES[:15]:
        for template in templates_category:
            text = template.format(category=category)
            start = text.index(category)
            end = start + len(category)
            augmented.append((text, [(start, end, "CATEGORY")]))

    # Date examples
    date_phrases = [
        ("yesterday", "DATE"),
        ("today", "DATE"),
        ("last month", "DATE"),
        ("this month", "DATE"),
        ("last week", "DATE"),
        ("this week", "DATE"),
        ("this year", "DATE"),
        ("january", "DATE"),
        ("february", "DATE"),
        ("march", "DATE"),
    ]
    date_templates = [
        "transactions from {date}",
        "spending {date}",
        "expenses {date}",
        "what did I spend {date}",
    ]
    for date_text, date_type in date_phrases:
        for template in date_templates:
            text = template.format(date=date_text)
            start = text.index(date_text)
            end = start + len(date_text)
            augmented.append((text, [(start, end, date_type)]))

    # Card examples
    templates_card = [
        "{card} card transactions",
        "{card} card expenses",
        "{card} card spending",
        "show {card} card transactions",
        "total spent on {card} card",
        "how much on {card} card",
        "list {card} card payments",
        "{card} card orders",
    ]

    for card in KNOWN_CARDS[:30]:  # Use top 30
        for template in templates_card:
            text = template.format(card=card)
            start = text.index(card)
            end = start + len(card)
            augmented.append((text, [(start, end, "CARD")]))

    # Card + Date combined
    templates_card_date = [
        "{card} card transactions {date}",
        "{card} card expenses {date}",
        "{card} card spending {date}",
    ]
    card_date_phrases = [
        "last month", "this month", "this week", "yesterday", "today",
    ]

    for card in KNOWN_CARDS[:15]:
        for date_text in card_date_phrases:
            for template in templates_card_date:
                text = template.format(card=card, date=date_text)
                card_start = text.index(card)
                card_end = card_start + len(card)
                date_start = text.index(date_text)
                date_end = date_start + len(date_text)
                augmented.append((text, [(card_start, card_end, "CARD"), (date_start, date_end, "DATE")]))

    # Merchant + Card combined
    templates_merchant_card = [
        "{merchant} transactions on {card} card",
        "{merchant} orders in {card} card",
        "my {merchant} transactions in {card} card",
        "show {merchant} on {card} card",
        "{merchant} on my {card} card",
        "total {merchant} spending on {card} card",
    ]
    card_names_short = ["sbi", "hdfc", "icici", "axis", "kotak"]
    merchant_names_short = KNOWN_MERCHANTS[:10]  # swiggy, zomato, starbucks, ...

    for merchant in merchant_names_short:
        for card in card_names_short:
            for template in templates_merchant_card:
                text = template.format(merchant=merchant, card=card)
                m_start = text.index(merchant)
                m_end = m_start + len(merchant)
                c_start = text.index(card)
                c_end = c_start + len(card)
                augmented.append((text, [(m_start, m_end, "MERCHANT"), (c_start, c_end, "CARD")]))

    # Merchant + Date + Card combined (date between merchant and card)
    templates_merchant_date_card = [
        "my {merchant} transactions in {date} with {card} card",
        "{merchant} orders in {date} on {card} card",
        "{merchant} in {date} from {card} card",
        "show {merchant} {date} on {card} card",
        "total {merchant} spending {date} from {card} card",
    ]
    card_date_combo_phrases = ["january", "february", "last month", "this month", "this week"]

    for merchant in KNOWN_MERCHANTS[:8]:
        for date_text in card_date_combo_phrases:
            for card in card_names_short[:3]:  # sbi, hdfc, icici
                for template in templates_merchant_date_card:
                    text = template.format(merchant=merchant, date=date_text, card=card)
                    m_start = text.index(merchant)
                    m_end = m_start + len(merchant)
                    d_start = text.index(date_text)
                    d_end = d_start + len(date_text)
                    c_start = text.index(card)
                    c_end = c_start + len(card)
                    augmented.append((text, [
                        (m_start, m_end, "MERCHANT"),
                        (d_start, d_end, "DATE"),
                        (c_start, c_end, "CARD"),
                    ]))

    # "No entity" examples from intent data
    no_entity_texts = [
        "how many transactions do I have",
        "total number of transactions",
        "what is my total spending",
        "show my transactions",
        "list all transactions",
        "what was my biggest expense",
        "average transaction amount",
        "monthly summary",
        "show recent transactions",
        "what are my latest expenses",
    ]
    for text in no_entity_texts:
        augmented.append((text, []))

    return augmented


# Combine hand-annotated + augmented
all_entity_data = ENTITY_EXAMPLES + generate_augmented_examples()

print(f"Total entity training examples: {len(all_entity_data)}")

# Convert to word-level BIO
all_words = []
all_tags = []
for text, entities in all_entity_data:
    words, tags = annotate_to_bio(text, entities)
    all_words.append(words)
    all_tags.append(tags)

# ---------------------------------------------------------------------------
# 4. Build vocabulary
# ---------------------------------------------------------------------------
word_counts = {}
for words in all_words:
    for w in words:
        word_counts[w] = word_counts.get(w, 0) + 1

vocab_sorted = sorted(word_counts.keys(), key=lambda w: -word_counts[w])
vocab_sorted = vocab_sorted[:MAX_TOKENS - 2]

word_to_id = {"<PAD>": 0, "<UNK>": 1}
for i, w in enumerate(vocab_sorted):
    word_to_id[w] = i + 2

vocab_size = len(word_to_id)
print(f"Entity vocab size: {vocab_size}")


def words_to_seq(words_list, max_len=SEQUENCE_LENGTH):
    """Convert word list to padded integer sequence."""
    seq = [word_to_id.get(w, 1) for w in words_list[:max_len]]
    seq += [0] * (max_len - len(seq))
    return seq


def tags_to_seq(tags_list, max_len=SEQUENCE_LENGTH):
    """Convert tag list to padded integer sequence."""
    seq = [tag_to_id[t] for t in tags_list[:max_len]]
    seq += [0] * (max_len - len(seq))  # 0 = "O" tag for padding
    return seq


# Convert all data
X = np.array([words_to_seq(w) for w in all_words], dtype=np.int32)
Y = np.array([tags_to_seq(t) for t in all_tags], dtype=np.int32)

# Shuffle and split
indices = np.random.RandomState(42).permutation(len(X))
X = X[indices]
Y = Y[indices]

split = int(0.85 * len(X))
X_train, X_val = X[:split], X[split:]
Y_train, Y_val = Y[:split], Y[split:]

print(f"Training: {len(X_train)}, Validation: {len(X_val)}")

# ---------------------------------------------------------------------------
# 5. Build sequence labeling model
# ---------------------------------------------------------------------------
# Use Conv1D instead of BiLSTM — TFLite-friendly, smaller, faster on mobile.
# Stacked dilated convolutions give wide receptive field for capturing context.

inputs = tf.keras.layers.Input(shape=(SEQUENCE_LENGTH,), dtype=tf.int32)
x = tf.keras.layers.Embedding(vocab_size, EMBEDDING_DIM, mask_zero=False)(inputs)
x = tf.keras.layers.Conv1D(128, 3, padding="same", activation="relu")(x)
x = tf.keras.layers.Dropout(0.3)(x)
x = tf.keras.layers.Conv1D(128, 3, padding="same", dilation_rate=2, activation="relu")(x)
x = tf.keras.layers.Dropout(0.2)(x)
x = tf.keras.layers.Conv1D(64, 3, padding="same", activation="relu")(x)
outputs = tf.keras.layers.TimeDistributed(
    tf.keras.layers.Dense(num_tags, activation="softmax")
)(x)

model = tf.keras.Model(inputs, outputs)
model.compile(
    optimizer="adam",
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

model.summary()

# ---------------------------------------------------------------------------
# 6. Train
# ---------------------------------------------------------------------------
# Reshape Y for sparse_categorical_crossentropy: (batch, seq_len, 1)
Y_train_exp = np.expand_dims(Y_train, -1)
Y_val_exp = np.expand_dims(Y_val, -1)

early_stop = tf.keras.callbacks.EarlyStopping(
    monitor="val_accuracy", patience=20, restore_best_weights=True
)

history = model.fit(
    X_train, Y_train_exp,
    validation_data=(X_val, Y_val_exp),
    epochs=EPOCHS,
    batch_size=BATCH_SIZE,
    callbacks=[early_stop],
    verbose=1,
)

val_loss, val_acc = model.evaluate(X_val, Y_val_exp, verbose=0)
print(f"\nFinal validation accuracy: {val_acc:.4f}")

# ---------------------------------------------------------------------------
# 7. Save and convert to TFLite
# ---------------------------------------------------------------------------
saved_model_path = os.path.join(OUTPUT_DIR, "entity_saved_model")
model.export(saved_model_path, format="tf_saved_model")

converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_path)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()

tflite_path = os.path.join(OUTPUT_DIR, "entity_model.tflite")
with open(tflite_path, "wb") as f:
    f.write(tflite_model)

tflite_size_kb = len(tflite_model) / 1024
print(f"Entity TFLite model: {tflite_path} ({tflite_size_kb:.1f} KB)")

# Save metadata
labels_path = os.path.join(OUTPUT_DIR, "entity_labels.json")
with open(labels_path, "w") as f:
    json.dump(tag_names, f, indent=2)

vocab_path = os.path.join(OUTPUT_DIR, "entity_vocab.json")
with open(vocab_path, "w") as f:
    json.dump(word_to_id, f, indent=2)

print(f"Entity labels: {labels_path}")
print(f"Entity vocab: {vocab_path}")

# ---------------------------------------------------------------------------
# 8. Test inference
# ---------------------------------------------------------------------------
print("\n--- TFLite Entity Inference Test ---")

interpreter = tf.lite.Interpreter(model_path=tflite_path)
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()


def extract_entities_tflite(sentence):
    """Run entity extraction on a sentence and return extracted entities."""
    words = sentence.lower().split()
    seq = np.array([words_to_seq(words)], dtype=np.int32)

    interpreter.set_tensor(input_details[0]["index"], seq)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details[0]["index"])[0]

    entities = {}
    current_entity = None
    current_words = []

    for i, word in enumerate(words[:SEQUENCE_LENGTH]):
        tag_id = np.argmax(output[i])
        tag = tag_names[tag_id]

        if tag.startswith("B-"):
            # Save previous entity
            if current_entity and current_words:
                entity_type = current_entity.lower()
                entities[entity_type] = " ".join(current_words)
            current_entity = tag[2:]
            current_words = [word]
        elif tag.startswith("I-") and current_entity == tag[2:]:
            current_words.append(word)
        else:
            if current_entity and current_words:
                entity_type = current_entity.lower()
                entities[entity_type] = " ".join(current_words)
            current_entity = None
            current_words = []

    # Flush last entity
    if current_entity and current_words:
        entity_type = current_entity.lower()
        entities[entity_type] = " ".join(current_words)

    return entities


test_sentences = [
    "how many swiggy transactions",
    "total spent on zomato this month",
    "amazon orders above 500",
    "food expenses last month",
    "show uber rides yesterday",
    "how much on netflix",
    "grocery spending this week",
    "list all transactions",
    "sbi card transactions",
    "hdfc card expenses this month",
    "show icici card food spending",
    "my swiggy transactions in sbi card",
    "uber rides on hdfc card",
    "my swiggy transactions in january with sbi card",
    "zomato orders last month on hdfc card",
]

for sentence in test_sentences:
    entities = extract_entities_tflite(sentence)
    print(f"  \"{sentence}\" → {json.dumps(entities)}")

print(f"\nDone! Entity model files in output/:")
print(f"  - entity_model.tflite ({tflite_size_kb:.1f} KB)")
print(f"  - entity_labels.json")
print(f"  - entity_vocab.json")
