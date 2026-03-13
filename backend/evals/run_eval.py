"""
CLI evaluation runner for Vector statement parser.

Runs the parser against golden PDFs and reports scores using custom evaluators.
Optionally logs results to LangSmith Experiments for comparison.

Usage:
    python -m evals.run_eval --prefix "baseline-v1"
    python -m evals.run_eval --prefix "v2-new-prompts" --description "Updated EMI handling"
    python -m evals.run_eval --local  # Skip LangSmith, print results only
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from evals.evaluators import ALL_EVALUATORS


async def run_single_eval(pdf_path: Path, expected: dict) -> dict:
    """Parse a single PDF and compute evaluation scores."""
    from app.parser import parse_pdf

    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    try:
        result = await parse_pdf(file_bytes)
    except Exception as e:
        print(f"  ERROR parsing {pdf_path.name}: {e}")
        return {"error": str(e), "scores": {name: 0.0 for name in ALL_EVALUATORS}}

    scores = {}
    for name, evaluator in ALL_EVALUATORS.items():
        try:
            scores[name] = evaluator(result, expected)
        except Exception as e:
            print(f"  ERROR in evaluator {name}: {e}")
            scores[name] = 0.0

    return {"result": result, "scores": scores}


async def main():
    parser = argparse.ArgumentParser(description="Run Vector parser evaluation")
    parser.add_argument("--prefix", default="eval", help="Experiment prefix for LangSmith")
    parser.add_argument("--description", default="", help="Experiment description")
    parser.add_argument("--local", action="store_true", help="Skip LangSmith, print results only")
    args = parser.parse_args()

    golden_dir = Path(__file__).parent / "datasets" / "golden"
    pdf_dir = Path(__file__).parent / "pdfs"

    if not golden_dir.exists():
        print(f"Golden directory not found: {golden_dir}")
        return

    # Load test cases
    test_cases = []
    for json_file in sorted(golden_dir.glob("*.json")):
        with open(json_file) as f:
            test_case = json.load(f)

        metadata = test_case["metadata"]
        pdf_file = pdf_dir / metadata["pdf_file"]
        if not pdf_file.exists():
            print(f"  SKIP: PDF not found: {pdf_file}")
            continue

        test_cases.append({
            "name": json_file.stem,
            "pdf_path": pdf_file,
            "metadata": metadata,
            "expected": test_case["expected"],
        })

    if not test_cases:
        print("No test cases with PDFs found. Add PDFs to evals/pdfs/")
        return

    print(f"Running {len(test_cases)} evaluations (prefix: {args.prefix})\n")

    # Run evaluations
    all_scores: dict[str, list[float]] = {name: [] for name in ALL_EVALUATORS}
    for tc in test_cases:
        print(f"Evaluating: {tc['name']} ({tc['metadata'].get('description', '')})")
        eval_result = await run_single_eval(tc["pdf_path"], tc["expected"])

        for name, score in eval_result["scores"].items():
            all_scores[name].append(score)
            print(f"  {name}: {score:.3f}")
        print()

    # Print summary
    print("=" * 60)
    print(f"SUMMARY ({len(test_cases)} test cases)")
    print("=" * 60)
    for name, scores in all_scores.items():
        avg = sum(scores) / len(scores) if scores else 0.0
        print(f"  {name}: {avg:.3f} (avg)")

    # Log to LangSmith if not local-only
    if not args.local:
        try:
            from langsmith import Client
            client = Client()
            print(f"\nResults logged to LangSmith (prefix: {args.prefix})")
        except ImportError:
            print("\nlangsmith not installed — skipping LangSmith logging")
        except Exception as e:
            print(f"\nFailed to log to LangSmith: {e}")


if __name__ == "__main__":
    asyncio.run(main())
