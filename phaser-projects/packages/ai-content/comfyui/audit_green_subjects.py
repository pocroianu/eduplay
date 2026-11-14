#!/usr/bin/env python3
"""Audit generated educational asset PNGs for chroma-key contamination.

Historically this script only detected GREEN-subject contamination (from the
first-pass chroma-key strategy that used a green background). The Duolingo
pipeline has since migrated to a MAGENTA chroma-key, so the script now
supports both color bands (and a custom range), controlled via `--color`.

Classification (for items NOT in the color's legitimate allowlist):
    broken   ratio > 0.40
    review   0.25 < ratio <= 0.40
    ok       ratio <= 0.25
    empty    <1% of the image is detected as subject

Allowlisted items (per color) are only flagged when the ratio is extreme —
they are expected to naturally carry that color (e.g. a frog for green, a
flamingo for magenta).

Usage:
    # Default: scan edu_assets_duolingo/ for magenta contamination (current pipeline)
    python packages/ai-content/comfyui/audit_green_subjects.py --root edu_assets_duolingo_2

    # Legacy green audit (for historical batches)
    python packages/ai-content/comfyui/audit_green_subjects.py --root edu_assets_duolingo --color green

    # Custom hue range
    python packages/ai-content/comfyui/audit_green_subjects.py --color custom --hue-lo 20 --hue-hi 50
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Optional

from postprocess import compute_dominant_color_ratio

# ---------------------------------------------------------------------------
# Hue ranges (HSV degrees, 0-360)
# ---------------------------------------------------------------------------

GREEN_HUE_RANGE: tuple[float, float] = (75.0, 165.0)
# Widened from (300, 330) to (285, 335): Qwen Image renders "hot magenta"
# slightly purple-shifted at hue ~295-299°, so a 300° lower bound misses
# fully-magenta subjects (e.g. the number-5 failure in the first test batch).
# 335° upper bound keeps us clear of legitimately pink subjects (flamingo,
# etc. typically land at 340-355°), which are additionally allowlisted.
MAGENTA_HUE_RANGE: tuple[float, float] = (285.0, 335.0)

# ---------------------------------------------------------------------------
# Per-color allowlists — subject-name substrings whose presence means the
# subject is LEGITIMATELY that color and should not be flagged unless the
# contamination is extreme.
# ---------------------------------------------------------------------------

GREEN_ALLOWLIST_PATTERNS = (
    "frog", "lettuce", "cactus", "christmas-tree", "turtle", "tortoise",
    "crocodile", "alligator", "snake", "iguana", "gecko", "chameleon",
    "salamander", "lizard", "caterpillar", "grasshopper", "broccoli",
    "leaf", "clover", "shamrock", "palm", "pine", "fern", "grass",
    "lime", "kiwi", "cucumber", "green-grapes", "green-apple", "avocado",
    "peas", "spinach", "asparagus", "zucchini", "celery", "cabbage",
    "mint", "basil", "parsley", "seaweed", "pickle", "dragon", "dinosaur",
    "tyrannosaurus", "triceratops", "stegosaurus", "brontosaurus",
    "pterodactyl", "velociraptor", "ankylosaurus", "spinosaurus",
    "anaconda", "tree-frog", "green-triangle", "green-circle",
    "green-square", "green-rectangle", "green-star", "green-heart",
    "green-", "bush", "shrub", "vine",
)

# Start deliberately small — grow it as real false positives appear.
MAGENTA_ALLOWLIST_PATTERNS = (
    "flamingo", "pig", "piglet", "bubblegum", "plum", "raspberry",
    "dragonfruit", "watermelon-flesh", "cherry-blossom", "pink-",
    "magenta-", "rose", "peony", "orchid", "hibiscus",
)

_ALLOWLISTS = {
    "green": GREEN_ALLOWLIST_PATTERNS,
    "magenta": MAGENTA_ALLOWLIST_PATTERNS,
    # "custom" audits have no semantic allowlist — nothing is allowlisted.
    "custom": (),
}


def resolve_hue_range(
    color: str,
    hue_lo: Optional[float] = None,
    hue_hi: Optional[float] = None,
) -> tuple[float, float]:
    """Return the (lo, hi) hue band for the given --color selection."""
    if color == "green":
        return GREEN_HUE_RANGE
    if color == "magenta":
        return MAGENTA_HUE_RANGE
    if color == "custom":
        if hue_lo is None or hue_hi is None:
            raise ValueError(
                "--color custom requires both --hue-lo and --hue-hi"
            )
        return (float(hue_lo), float(hue_hi))
    raise ValueError(f"unknown color: {color!r}")


def is_allowlisted(prefix: str, color: str = "magenta") -> bool:
    """True iff `prefix` matches a substring in the allowlist for `color`."""
    name = prefix.lower()
    patterns = _ALLOWLISTS.get(color, ())
    return any(pat in name for pat in patterns)


def classify(
    prefix: str,
    ratio: float,
    subject_fraction: float,
    color: str = "magenta",
) -> str:
    """Return one of: 'broken', 'review', 'ok', 'empty'.

    subject_fraction is subject_pixels / total_pixels."""
    if subject_fraction < 0.01:
        return "empty"
    if is_allowlisted(prefix, color=color):
        # Allow almost anything for legitimately-colored subjects
        if ratio > 0.98 and subject_fraction > 0.95:
            # Almost the entire image is the target color — possibly still a
            # failure (e.g. all-color frame). Flag for review.
            return "review"
        return "ok"
    if ratio > 0.40:
        return "broken"
    if ratio > 0.25:
        return "review"
    return "ok"


def audit_directory(
    root: Path,
    hue_range: tuple[float, float] = MAGENTA_HUE_RANGE,
    color: str = "magenta",
) -> dict:
    """Scan `root` recursively for PNGs and classify each."""
    results = []
    summary = {"broken": [], "review": [], "ok": [], "empty": []}

    pngs = sorted(root.glob("**/*.png"))

    for p in pngs:
        # Derive prefix from filename (strip the _NNNNN_ counter suffix)
        stem = p.stem  # e.g. "numbers_number-seven_00002_"
        parts = stem.rsplit("_", 2)
        prefix = parts[0] if len(parts) >= 2 and parts[1].isdigit() else stem

        try:
            from PIL import Image
            with Image.open(p) as img:
                w, h = img.size
            total = max(w * h, 1)
            ratio, subject_pixels = compute_dominant_color_ratio(
                p, hue_range=hue_range
            )
            subject_fraction = subject_pixels / total
        except Exception as e:
            entry = {
                "path": str(p),
                "prefix": prefix,
                "classification": "error",
                "error": str(e),
            }
            results.append(entry)
            continue

        cls = classify(prefix, ratio, subject_fraction, color=color)
        category = p.parent.name
        entry = {
            "path": str(p),
            "category": category,
            "prefix": prefix,
            "ratio": round(ratio, 4),
            "subject_fraction": round(subject_fraction, 4),
            "classification": cls,
            "allowlisted": is_allowlisted(prefix, color=color),
        }
        results.append(entry)
        if cls in summary:
            summary[cls].append(prefix)

    # De-duplicate prefix lists (multiple images can share a prefix)
    for key in summary:
        summary[key] = sorted(set(summary[key]))

    return {
        "root": str(root),
        "color": color,
        "hue_range": list(hue_range),
        "total_scanned": len(results),
        "summary_counts": {k: len(v) for k, v in summary.items()},
        "summary": summary,
        "items": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit generated PNGs for chroma-key color contamination"
    )
    parser.add_argument("--root", type=Path, default=Path("edu_assets_duolingo"),
                        help="Directory to scan (default: edu_assets_duolingo)")
    parser.add_argument("--report", type=Path, default=None,
                        help="Where to write audit_report.json (default: <root>/audit_report.json)")
    parser.add_argument("--regen-json", type=Path, default=None,
                        help="If set, also write a list of broken+empty prefixes to this path")
    parser.add_argument("--color", choices=("green", "magenta", "custom"),
                        default="magenta",
                        help="Which color band to audit (default: magenta — current pipeline)")
    parser.add_argument("--hue-lo", type=float, default=None,
                        help="Custom hue band lower bound, degrees 0-360 (with --color custom)")
    parser.add_argument("--hue-hi", type=float, default=None,
                        help="Custom hue band upper bound, degrees 0-360 (with --color custom)")
    args = parser.parse_args()

    root = args.root
    if not root.exists():
        print(f"ERROR: root directory does not exist: {root}")
        return 1

    try:
        hue_range = resolve_hue_range(args.color, args.hue_lo, args.hue_hi)
    except ValueError as e:
        print(f"ERROR: {e}")
        return 2

    print(f"Scanning {root.resolve()} for {args.color} contamination "
          f"(hue {hue_range[0]}-{hue_range[1]}°) ...")
    report = audit_directory(root, hue_range=hue_range, color=args.color)

    report_path = args.report or (root / "audit_report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2))
    print(f"\nReport written: {report_path}")

    counts = report["summary_counts"]
    print(f"\nScanned {report['total_scanned']} PNGs")
    print(f"  broken:  {counts['broken']}")
    print(f"  review:  {counts['review']}")
    print(f"  empty:   {counts['empty']}")
    print(f"  ok:      {counts['ok']}")

    if counts["broken"]:
        print("\nBROKEN items (sample):")
        for pfx in report["summary"]["broken"][:20]:
            print(f"  {pfx}")

    if counts["review"]:
        print("\nREVIEW items (sample):")
        for pfx in report["summary"]["review"][:20]:
            print(f"  {pfx}")

    if args.regen_json:
        regen = sorted(set(report["summary"]["broken"] + report["summary"]["empty"]))
        args.regen_json.parent.mkdir(parents=True, exist_ok=True)
        args.regen_json.write_text(json.dumps(regen, indent=2))
        print(f"\nRegen list written: {args.regen_json}  ({len(regen)} prefixes)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
