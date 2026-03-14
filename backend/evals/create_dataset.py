"""
Upload golden test data to LangSmith as a dataset for evaluation.

Usage:
    python -m evals.create_dataset [--name DATASET_NAME]

Requires LANGCHAIN_API_KEY to be set.
"""

import argparse
import json
from pathlib import Path

from langsmith import Client


def main():
    parser = argparse.ArgumentParser(description="Create LangSmith dataset from golden test files")
    parser.add_argument("--name", default="vector-golden-v1", help="Dataset name in LangSmith")
    args = parser.parse_args()

    golden_dir = Path(__file__).parent / "datasets" / "golden"
    if not golden_dir.exists():
        print(f"Golden directory not found: {golden_dir}")
        return

    client = Client()

    # Create or get existing dataset
    try:
        dataset = client.create_dataset(args.name, description="Vector statement parser golden test cases")
        print(f"Created dataset: {args.name}")
    except Exception:
        dataset = client.read_dataset(dataset_name=args.name)
        print(f"Using existing dataset: {args.name}")

    # Upload each golden test case as an example
    count = 0
    for json_file in sorted(golden_dir.glob("*.json")):
        with open(json_file) as f:
            test_case = json.load(f)

        metadata = test_case.get("metadata", {})
        expected = test_case.get("expected", {})
        pdf_file = metadata.get("pdf_file", "")

        client.create_example(
            inputs={"pdf_file": pdf_file, "metadata": metadata},
            outputs=expected,
            dataset_id=dataset.id,
            metadata=metadata,
        )
        count += 1
        print(f"  Added: {json_file.name} ({metadata.get('description', '')})")

    print(f"\nUploaded {count} examples to dataset '{args.name}'")


if __name__ == "__main__":
    main()
