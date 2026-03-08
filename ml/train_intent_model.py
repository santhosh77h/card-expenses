"""
Train a TensorFlow Lite intent classifier for Vector expense app.

Produces: output/intent_model.tflite + output/intent_labels.json + output/intent_vocab.json

Usage:
    cd ml
    pip install -r requirements.txt
    python train_intent_model.py
"""

import json
import os
import numpy as np
import tensorflow as tf
from training_data import INTENT_EXAMPLES

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MAX_TOKENS = 2000
SEQUENCE_LENGTH = 20
EMBEDDING_DIM = 64
HIDDEN_DIM = 64
EPOCHS = 100
BATCH_SIZE = 16
OUTPUT_DIR = "output"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# 1. Prepare dataset
# ---------------------------------------------------------------------------
texts = []
labels = []
intent_names = sorted(INTENT_EXAMPLES.keys())
intent_to_id = {name: i for i, name in enumerate(intent_names)}
num_intents = len(intent_names)

print(f"Intents ({num_intents}): {intent_names}")

for intent, examples in INTENT_EXAMPLES.items():
    for text in examples:
        texts.append(text.lower().strip())
        labels.append(intent_to_id[intent])

texts = np.array(texts)
labels = np.array(labels)

# Shuffle
indices = np.random.RandomState(42).permutation(len(texts))
texts = texts[indices]
labels = labels[indices]

# Split 85/15
split = int(0.85 * len(texts))
train_texts, val_texts = texts[:split], texts[split:]
train_labels, val_labels = labels[:split], labels[split:]

print(f"Training samples: {len(train_texts)}, Validation samples: {len(val_texts)}")

# ---------------------------------------------------------------------------
# 2. Build vocabulary manually (for TFLite compatibility)
# ---------------------------------------------------------------------------
# TextVectorization doesn't export well to TFLite, so we build our own vocab
# and use an Embedding lookup approach.

word_counts = {}
for text in train_texts:
    for word in text.split():
        word_counts[word] = word_counts.get(word, 0) + 1

# Sort by frequency, reserve 0 for padding, 1 for unknown
vocab_words = sorted(word_counts.keys(), key=lambda w: -word_counts[w])
vocab_words = vocab_words[:MAX_TOKENS - 2]  # leave room for PAD and UNK

word_to_id = {"<PAD>": 0, "<UNK>": 1}
for i, word in enumerate(vocab_words):
    word_to_id[word] = i + 2

vocab_size = len(word_to_id)
print(f"Vocabulary size: {vocab_size}")


def texts_to_sequences(text_array, max_len=SEQUENCE_LENGTH):
    """Convert text array to padded integer sequences."""
    sequences = []
    for text in text_array:
        words = text.split()
        seq = [word_to_id.get(w, 1) for w in words[:max_len]]
        # Pad to max_len
        seq += [0] * (max_len - len(seq))
        sequences.append(seq)
    return np.array(sequences, dtype=np.int32)


train_seqs = texts_to_sequences(train_texts)
val_seqs = texts_to_sequences(val_texts)

# ---------------------------------------------------------------------------
# 3. Build model
# ---------------------------------------------------------------------------
model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(input_shape=(SEQUENCE_LENGTH,), dtype=tf.int32),
    tf.keras.layers.Embedding(vocab_size, EMBEDDING_DIM, mask_zero=True),
    tf.keras.layers.GlobalAveragePooling1D(),
    tf.keras.layers.Dense(HIDDEN_DIM, activation="relu"),
    tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(HIDDEN_DIM // 2, activation="relu"),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(num_intents, activation="softmax"),
])

model.compile(
    optimizer="adam",
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

model.summary()

# ---------------------------------------------------------------------------
# 4. Train
# ---------------------------------------------------------------------------
early_stop = tf.keras.callbacks.EarlyStopping(
    monitor="val_accuracy", patience=15, restore_best_weights=True
)

history = model.fit(
    train_seqs, train_labels,
    validation_data=(val_seqs, val_labels),
    epochs=EPOCHS,
    batch_size=BATCH_SIZE,
    callbacks=[early_stop],
    verbose=1,
)

val_loss, val_acc = model.evaluate(val_seqs, val_labels, verbose=0)
print(f"\nFinal validation accuracy: {val_acc:.4f}")

# ---------------------------------------------------------------------------
# 5. Export as SavedModel (for TFLite conversion)
# ---------------------------------------------------------------------------
saved_model_path = os.path.join(OUTPUT_DIR, "intent_saved_model")
model.export(saved_model_path, format="tf_saved_model")
print(f"Exported SavedModel to {saved_model_path}")

# ---------------------------------------------------------------------------
# 6. Convert to TensorFlow Lite
# ---------------------------------------------------------------------------
converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_path)
converter.optimizations = [tf.lite.Optimize.DEFAULT]  # quantize for smaller size
tflite_model = converter.convert()

tflite_path = os.path.join(OUTPUT_DIR, "intent_model.tflite")
with open(tflite_path, "wb") as f:
    f.write(tflite_model)

tflite_size_kb = len(tflite_model) / 1024
print(f"TFLite model saved to {tflite_path} ({tflite_size_kb:.1f} KB)")

# ---------------------------------------------------------------------------
# 7. Save metadata (labels + vocab) for mobile runtime
# ---------------------------------------------------------------------------
labels_path = os.path.join(OUTPUT_DIR, "intent_labels.json")
with open(labels_path, "w") as f:
    json.dump(intent_names, f, indent=2)
print(f"Intent labels saved to {labels_path}")

vocab_path = os.path.join(OUTPUT_DIR, "intent_vocab.json")
with open(vocab_path, "w") as f:
    json.dump(word_to_id, f, indent=2)
print(f"Vocabulary saved to {vocab_path}")

# ---------------------------------------------------------------------------
# 8. Test inference with TFLite
# ---------------------------------------------------------------------------
print("\n--- TFLite Inference Test ---")

interpreter = tf.lite.Interpreter(model_path=tflite_path)
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

test_sentences = [
    "how many swiggy transactions",
    "how much did I spend on food",
    "what did I spend yesterday",
    "show my grocery spending",
    "list all transactions",
    "what was my biggest expense",
    "average spending on uber",
    "monthly summary",
]

for sentence in test_sentences:
    seq = texts_to_sequences(np.array([sentence.lower()]))
    interpreter.set_tensor(input_details[0]["index"], seq)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details[0]["index"])[0]
    predicted_id = np.argmax(output)
    confidence = output[predicted_id]
    print(f"  \"{sentence}\" → {intent_names[predicted_id]} ({confidence:.2%})")

print("\nDone! Files in output/:")
print(f"  - intent_model.tflite ({tflite_size_kb:.1f} KB)")
print(f"  - intent_labels.json")
print(f"  - intent_vocab.json")
