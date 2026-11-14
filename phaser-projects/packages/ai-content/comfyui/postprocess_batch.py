#!/usr/bin/env python3
"""Standalone batch re-processor for existing generated assets.

Walks a directory tree, removes the background from every PNG, and overwrites
the file in place with a transparent RGBA version. Already-RGBA files are
skipped. Crash-safe: logs progress to a JSON file so it can be resumed.

Usage:
    python packages/ai-content/comfyui/postprocess_batch.py edu_assets_duolingo/
    python packages/ai-content/comfyui/postprocess_batch.py edu_assets_duolingo/ --dry-run
    python packages/ai-content/comfyui/postprocess_batch.py edu_assets_duolingo/ --alpha-matting
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image

from postprocess import create_session, remove_background


def find_png_files(root: Path) -> list[Path]:
    """Recursively collect all .png files under root (excluding log files)."""
    return sorted(p for p in root.rglob("*.png") if p.is_file())


def is_rgba(path: Path) -> bool:
    """Return True if the PNG already has an alpha channel."""
    try:
        with Image.open(path) as img:
            return img.mode == "RGBA"
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Re-process existing generated assets to remove backgrounds."
    )
    parser.add_argument(
        "directory",
        type=Path,
        help="Root directory to process (e.g. edu_assets_duolingo/)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List files that would be processed without modifying them",
    )
    parser.add_argument(
        "--alpha-matting",
        action="store_true",
        help="Enable alpha matting for cleaner edges (~2x slower)",
    )
    parser.add_argument(
        "--model",
        default="u2net",
        help="rembg model to use (default: u2net)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-process files that are already RGBA",
    )
    args = parser.parse_args()

    root = args.directory.resolve()
    if not root.exists() or not root.is_dir():
        print(f"ERROR: {root} is not a directory", file=sys.stderr)
        sys.exit(1)

    log_file = root / "postprocess_log.json"

    # Load existing log for resume support
    log: list[dict] = []
    processed_paths: set[str] = set()
    if log_file.exists():
        try:
            log = json.loads(log_file.read_text())
            processed_paths = {
                entry["path"] for entry in log if entry.get("status") == "ok"
            }
        except Exception:
            pass

    print(f"=== Background Removal Batch ===")
    print(f"Root: {root}")
    print(f"Model: {args.model}")
    print(f"Alpha matting: {args.alpha_matting}")
    print(f"Dry run: {args.dry_run}")
    print(f"Force: {args.force}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    all_files = find_png_files(root)
    total = len(all_files)
    print(f"Found {total} PNG files")

    if processed_paths:
        print(f"Resuming: {len(processed_paths)} already processed")
    print(f"{'='*50}\n")

    if args.dry_run:
        for f in all_files:
            rel = f.relative_to(root)
            if str(f) in processed_paths:
                status = "SKIP (already processed)"
            elif not args.force and is_rgba(f):
                status = "SKIP (already RGBA)"
            else:
                status = "WOULD PROCESS"
            print(f"  {status}: {rel}")
        return

    # Load rembg session once
    print("Loading rembg model...")
    session = create_session(args.model)
    print("Ready.\n")

    processed = 0
    skipped = 0
    failed = 0

    for i, path in enumerate(all_files, 1):
        rel = path.relative_to(root)
        path_str = str(path)

        if path_str in processed_paths:
            skipped += 1
            continue

        if not args.force and is_rgba(path):
            skipped += 1
            print(f"[{i}/{total}] SKIP (RGBA) {rel}")
            log.append({
                "path": path_str,
                "status": "skip_rgba",
                "timestamp": datetime.now().isoformat(),
            })
            continue

        print(f"[{i}/{total}] {rel}")
        entry = {
            "path": path_str,
            "timestamp": datetime.now().isoformat(),
        }

        try:
            remove_background(
                path, path, session, alpha_matting=args.alpha_matting
            )
            entry["status"] = "ok"
            processed += 1
        except Exception as e:
            entry["status"] = "error"
            entry["error"] = str(e)
            print(f"  ERROR: {e}")
            failed += 1

        log.append(entry)

        # Crash-safe: save log every 10 items
        if i % 10 == 0:
            log_file.write_text(json.dumps(log, indent=2))

    # Final log save
    log_file.write_text(json.dumps(log, indent=2))

    print(f"\n{'='*50}")
    print(f"=== COMPLETE ===")
    print(f"Processed: {processed}")
    print(f"Skipped:   {skipped}")
    print(f"Failed:    {failed}")
    print(f"Total:     {total}")
    print(f"Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Log: {log_file}")


if __name__ == "__main__":
    main()
