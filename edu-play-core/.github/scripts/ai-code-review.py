#!/usr/bin/env python3
"""Dormant AI code review helper.

Originally invoked by .github/workflows/code-review.yml; no active workflow
currently calls this script in edu-play-core.

Phase 1 MVP of EDU-73 / EDU-83. Reads a unified PR diff, calls the Anthropic
Messages API with `.github/code-review-system.md` as a cached system prompt,
and writes three output artifacts to ``--output-dir``:

* ``review.json`` — parsed model response: {summary, comments[]}.
* ``summary.md``  — human-readable summary for PR comment / Paperclip mirror.
* ``usage.json``  — tokens, model, cost stamp inputs (consumed by the workflow).

The script never uploads anything itself; the workflow does the GitHub PR
Review post and the Paperclip mirror via existing helpers.

External-contributor protection is enforced here: if the diff token estimate
exceeds the per-PR input cap and the PR author is not OWNER/MEMBER/COLLABORATOR,
we write a ``skip-reason.txt`` to the output dir and exit 0. The workflow then
posts the skip comment instead of calling Anthropic.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
INTERNAL_AUTHOR_ASSOCIATIONS = {"OWNER", "MEMBER", "COLLABORATOR"}

MODEL_PRICING_USD_PER_MTOK: dict[str, dict[str, float]] = {
    # Approximate list pricing as of 2026-Q1. Used only for the observability
    # cost stamp on the Paperclip mirror — not for billing decisions.
    "claude-sonnet-4-6": {
        "input": 3.0,
        "output": 15.0,
        "cache_write": 3.75,
        "cache_read": 0.30,
    },
    "claude-opus-4-7": {
        "input": 15.0,
        "output": 75.0,
        "cache_write": 18.75,
        "cache_read": 1.50,
    },
}
MODEL_LABEL: dict[str, str] = {
    "claude-sonnet-4-6": "Sonnet 4.6",
    "claude-opus-4-7": "Opus 4.7",
}


@dataclass
class Usage:
    input_tokens: int
    output_tokens: int
    cache_creation_input_tokens: int
    cache_read_input_tokens: int

    @property
    def total_input_tokens(self) -> int:
        return (
            self.input_tokens
            + self.cache_creation_input_tokens
            + self.cache_read_input_tokens
        )


def estimate_input_tokens(*texts: str) -> int:
    """Rough heuristic for the pre-flight token cap: ~4 chars per token."""
    chars = sum(len(t) for t in texts)
    return chars // 4


def is_external_contributor(author_association: str | None) -> bool:
    if not author_association:
        return True
    return author_association.upper() not in INTERNAL_AUTHOR_ASSOCIATIONS


def call_anthropic(
    *,
    api_key: str,
    model: str,
    system_prompt: str,
    user_message: str,
) -> dict[str, Any]:
    body = {
        "model": model,
        "max_tokens": 4096,
        "system": [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        "messages": [
            {"role": "user", "content": [{"type": "text", "text": user_message}]}
        ],
    }
    req = urllib.request.Request(
        ANTHROPIC_API_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "x-api-key": api_key,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def extract_text(response: dict[str, Any]) -> str:
    parts = response.get("content") or []
    return "".join(p.get("text", "") for p in parts if p.get("type") == "text")


def parse_review_json(text: str) -> dict[str, Any]:
    """Parse the model's response, tolerating fenced JSON blocks."""
    stripped = text.strip()
    # Strip ```json ... ``` fences if the model adds them despite the contract.
    if stripped.startswith("```"):
        first_newline = stripped.find("\n")
        if first_newline != -1:
            stripped = stripped[first_newline + 1 :]
        if stripped.endswith("```"):
            stripped = stripped[:-3]
        stripped = stripped.strip()

    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return {
            "summary": "Model returned non-JSON output. Skipping inline comments.",
            "comments": [],
            "_raw": text[:500],
        }

    if not isinstance(parsed, dict):
        return {
            "summary": "Model returned non-object JSON. Skipping inline comments.",
            "comments": [],
        }

    summary = str(parsed.get("summary") or "").strip()
    comments_raw = parsed.get("comments") or []
    comments: list[dict[str, Any]] = []
    if isinstance(comments_raw, list):
        for item in comments_raw:
            if not isinstance(item, dict):
                continue
            severity = str(item.get("severity") or "").lower()
            file_path = str(item.get("file") or "").strip()
            line = item.get("line")
            body = str(item.get("comment") or "").strip()
            if severity not in {"blocker", "high", "medium", "low"}:
                continue
            if not file_path or not body:
                continue
            try:
                line_int = int(line)
            except (TypeError, ValueError):
                continue
            comments.append(
                {
                    "severity": severity,
                    "file": file_path,
                    "line": line_int,
                    "comment": body[:800],
                }
            )

    return {"summary": summary, "comments": comments}


def apply_noise_budget(comments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Match the noise budget described in the system prompt.

    The model is told to do this itself — we re-apply it defensively in case
    the model overshoots, so the PR experience stays consistent.
    """
    if len(comments) <= 5:
        return comments
    if len(comments) <= 10:
        return [c for c in comments if c["severity"] != "low"]
    return [c for c in comments if c["severity"] in {"high", "blocker"}]


def severity_emoji(severity: str) -> str:
    return {
        "blocker": "🛑",
        "high": "⚠️",
        "medium": "📝",
        "low": "💡",
    }.get(severity, "•")


def render_summary_md(
    *,
    review: dict[str, Any],
    pr_url: str,
    model_label: str,
    cost_stamp: str,
) -> str:
    lines: list[str] = []
    lines.append(f"### AI code review — [edu-play-bot]")
    lines.append("")
    lines.append(f"**Model:** {model_label}")
    if pr_url:
        lines.append(f"**PR:** {pr_url}")
    lines.append("")
    summary = (review.get("summary") or "").strip()
    if summary:
        lines.append(summary)
        lines.append("")
    comments = review.get("comments") or []
    if comments:
        lines.append(f"**{len(comments)} inline comment(s) posted on the diff:**")
        lines.append("")
        for c in comments:
            lines.append(
                f"- {severity_emoji(c['severity'])} `{c['file']}:{c['line']}` "
                f"_{c['severity']}_ — {c['comment'].splitlines()[0][:200]}"
            )
        lines.append("")
    else:
        lines.append("_No inline comments — the diff looks clean to the bot._")
        lines.append("")
    lines.append("---")
    lines.append(cost_stamp)
    return "\n".join(lines) + "\n"


def compute_cost_usd(model: str, usage: Usage) -> float:
    pricing = MODEL_PRICING_USD_PER_MTOK.get(model)
    if not pricing:
        return 0.0
    cost = (
        usage.input_tokens * pricing["input"]
        + usage.cache_creation_input_tokens * pricing["cache_write"]
        + usage.cache_read_input_tokens * pricing["cache_read"]
        + usage.output_tokens * pricing["output"]
    ) / 1_000_000
    return round(cost, 4)


def format_cost_stamp(model: str, usage: Usage, cost_usd: float) -> str:
    label = MODEL_LABEL.get(model, model)
    return (
        f"~${cost_usd:.2f} · {label} · "
        f"{usage.total_input_tokens / 1000:.1f}K in / "
        f"{usage.output_tokens / 1000:.1f}K out"
    )


def write_outputs(
    *,
    output_dir: Path,
    review: dict[str, Any],
    summary_md: str,
    usage: Usage,
    model: str,
    cost_usd: float,
    cost_stamp: str,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "review.json").write_text(
        json.dumps(review, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (output_dir / "summary.md").write_text(summary_md, encoding="utf-8")
    (output_dir / "usage.json").write_text(
        json.dumps(
            {
                "model": model,
                "model_label": MODEL_LABEL.get(model, model),
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
                "cache_creation_input_tokens": usage.cache_creation_input_tokens,
                "cache_read_input_tokens": usage.cache_read_input_tokens,
                "total_input_tokens": usage.total_input_tokens,
                "cost_usd": cost_usd,
                "cost_stamp": cost_stamp,
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def write_skip(output_dir: Path, reason: str) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "skip-reason.txt").write_text(reason, encoding="utf-8")


def build_user_message(
    *,
    pr_title: str,
    pr_branch: str,
    pr_base_sha: str,
    pr_head_sha: str,
    diff: str,
) -> str:
    return (
        f"## PR metadata\n\n"
        f"- Title: {pr_title}\n"
        f"- Branch: {pr_branch}\n"
        f"- Base SHA: {pr_base_sha}\n"
        f"- Head SHA: {pr_head_sha}\n\n"
        f"## Unified diff\n\n"
        f"```diff\n{diff}\n```\n\n"
        f"Review this diff per the system contract. Return JSON only."
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__ or "")
    parser.add_argument("--diff-file", required=True)
    parser.add_argument("--system-prompt-file", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--pr-title", default="")
    parser.add_argument("--pr-branch", default="")
    parser.add_argument("--pr-base-sha", default="")
    parser.add_argument("--pr-head-sha", default="")
    parser.add_argument("--pr-url", default="")
    parser.add_argument("--author-association", default="")
    parser.add_argument("--max-input-tokens-external", type=int, default=50_000)
    args = parser.parse_args(argv)

    output_dir = Path(args.output_dir)
    diff_path = Path(args.diff_file)
    system_path = Path(args.system_prompt_file)

    if not diff_path.is_file():
        print(f"diff file missing: {diff_path}", file=sys.stderr)
        return 1
    if not system_path.is_file():
        print(f"system prompt missing: {system_path}", file=sys.stderr)
        return 1

    diff = diff_path.read_text(encoding="utf-8", errors="replace")
    system_prompt = system_path.read_text(encoding="utf-8")

    if not diff.strip():
        write_skip(output_dir, "Diff was empty after exclusion filters.")
        return 0

    user_message = build_user_message(
        pr_title=args.pr_title,
        pr_branch=args.pr_branch,
        pr_base_sha=args.pr_base_sha,
        pr_head_sha=args.pr_head_sha,
        diff=diff,
    )

    estimated = estimate_input_tokens(system_prompt, user_message)
    if (
        is_external_contributor(args.author_association)
        and estimated > args.max_input_tokens_external
    ):
        write_skip(
            output_dir,
            (
                f"PR too large for auto-review on external PRs "
                f"(~{estimated} estimated input tokens > {args.max_input_tokens_external} cap)."
            ),
        )
        return 0

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY missing in environment.", file=sys.stderr)
        return 1

    try:
        response = call_anthropic(
            api_key=api_key,
            model=args.model,
            system_prompt=system_prompt,
            user_message=user_message,
        )
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:500]
        print(f"Anthropic API HTTP {exc.code}: {body}", file=sys.stderr)
        return 1
    except urllib.error.URLError as exc:
        print(f"Anthropic API request failed: {exc}", file=sys.stderr)
        return 1

    text = extract_text(response)
    review = parse_review_json(text)
    review["comments"] = apply_noise_budget(list(review.get("comments") or []))

    usage_raw = response.get("usage", {}) or {}
    usage = Usage(
        input_tokens=int(usage_raw.get("input_tokens", 0) or 0),
        output_tokens=int(usage_raw.get("output_tokens", 0) or 0),
        cache_creation_input_tokens=int(
            usage_raw.get("cache_creation_input_tokens", 0) or 0
        ),
        cache_read_input_tokens=int(
            usage_raw.get("cache_read_input_tokens", 0) or 0
        ),
    )

    cost_usd = compute_cost_usd(args.model, usage)
    cost_stamp = format_cost_stamp(args.model, usage, cost_usd)
    summary_md = render_summary_md(
        review=review,
        pr_url=args.pr_url,
        model_label=MODEL_LABEL.get(args.model, args.model),
        cost_stamp=cost_stamp,
    )

    write_outputs(
        output_dir=output_dir,
        review=review,
        summary_md=summary_md,
        usage=usage,
        model=args.model,
        cost_usd=cost_usd,
        cost_stamp=cost_stamp,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
