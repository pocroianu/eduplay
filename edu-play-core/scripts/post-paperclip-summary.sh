#!/usr/bin/env bash
#
# post-paperclip-summary.sh — mirror an AI code-review summary to a Paperclip issue.
#
# Used by the GitHub Actions code-review workflows in:
#   - edu-play-core   (.github/workflows/code-review.yml — EDU-73-A / EDU-83)
#   - phaser-projects (.github/workflows/code-review.yml — EDU-73-B / EDU-84)
#
# The phaser-projects workflow invokes this script by checking out edu-play-core
# at a pinned SHA (one source of truth) — see EDU-82 acceptance criteria. This
# avoids drift between two vendored copies.
#
# CI secrets required (set on both repos):
#   PAPERCLIP_API_KEY  — bearer token for the Paperclip API
#   PAPERCLIP_API_URL  — optional, defaults to production
#
# Behavior contract:
#   * Issue ID resolution: explicit --issue-id wins; otherwise extract from
#     $GITHUB_HEAD_REF (e.g. feat/EDU-42-foo → EDU-42). No match → log + exit 0.
#   * Composes a markdown comment with: status line, PR link, summary body
#     (truncated to 3000 chars), and a token/cost stamp.
#   * Cost stamp format (exact): ~$0.04 · Sonnet 4.6 · 7.2K in / 1.1K out
#   * POSTs to /api/issues/{issueId}/comments with the run-id header
#     "X-Paperclip-Run-Id: ci-${GITHUB_RUN_ID}".
#   * Newlines preserved via jq --rawfile (never one-line JSON).
#   * Never fails the workflow: any error → log to stderr, exit 0.
#
# Usage:
#   ./scripts/post-paperclip-summary.sh \
#     --issue-id      "EDU-42" \
#     --pr-url        "https://github.com/owner/repo/pull/123" \
#     --summary-file  "/tmp/review-summary.md" \
#     --input-tokens  7200 \
#     --output-tokens 1100 \
#     --model         "claude-sonnet-4-6" \
#     --cost-usd      "0.04"

set -uo pipefail

# Default API base — paperclip skill says fall back to production if env unset.
readonly POST_PAPERCLIP_DEFAULT_API_URL="https://app.paperclip.ing"
readonly POST_PAPERCLIP_SUMMARY_MAX_CHARS=3000

# Log to stderr, never to stdout (so callers can capture stdout cleanly).
post_paperclip_summary::log() {
  printf '[post-paperclip-summary] %s\n' "$*" >&2
}

# Format a model slug or label into the human-readable form used in the stamp.
# Inputs we expect from CI: "claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5".
# Already-friendly inputs ("Sonnet 4.6") pass through unchanged.
post_paperclip_summary::format_model_label() {
  local raw="${1:-}"
  if [[ -z "${raw}" ]]; then
    printf '%s' "Unknown"
    return 0
  fi

  # Already human-friendly (contains a space and a dot) — pass through.
  if [[ "${raw}" == *" "* && "${raw}" == *.* ]]; then
    printf '%s' "${raw}"
    return 0
  fi

  # Match claude-{family}-{major}-{minor} (allow optional date suffix segments).
  if [[ "${raw}" =~ ^claude-([a-z]+)-([0-9]+)-([0-9]+) ]]; then
    local family="${BASH_REMATCH[1]}"
    local major="${BASH_REMATCH[2]}"
    local minor="${BASH_REMATCH[3]}"
    local family_titled
    family_titled="$(tr '[:lower:]' '[:upper:]' <<<"${family:0:1}")${family:1}"
    printf '%s %s.%s' "${family_titled}" "${major}" "${minor}"
    return 0
  fi

  # Unknown shape — return as-is rather than failing.
  printf '%s' "${raw}"
}

# Format an integer token count into the "7.2K" form (1 decimal + K suffix).
post_paperclip_summary::format_tokens() {
  local raw="${1:-0}"
  if ! [[ "${raw}" =~ ^[0-9]+$ ]]; then
    printf '0.0K'
    return 0
  fi
  awk -v n="${raw}" 'BEGIN { printf "%.1fK", n / 1000 }'
}

# Format a USD cost (e.g. 0.04, 0.0438) as "$0.04" (2 decimal places).
post_paperclip_summary::format_cost() {
  local raw="${1:-0}"
  if ! [[ "${raw}" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    printf '$0.00'
    return 0
  fi
  awk -v n="${raw}" 'BEGIN { printf "$%.2f", n }'
}

# Build the one-line cost stamp: "~$0.04 · Sonnet 4.6 · 7.2K in / 1.1K out".
post_paperclip_summary::format_cost_stamp() {
  local cost_usd="${1:-0}"
  local model="${2:-}"
  local input_tokens="${3:-0}"
  local output_tokens="${4:-0}"

  local cost
  cost="$(post_paperclip_summary::format_cost "${cost_usd}")"
  local model_label
  model_label="$(post_paperclip_summary::format_model_label "${model}")"
  local in_tokens
  in_tokens="$(post_paperclip_summary::format_tokens "${input_tokens}")"
  local out_tokens
  out_tokens="$(post_paperclip_summary::format_tokens "${output_tokens}")"

  printf '~%s · %s · %s in / %s out' \
    "${cost}" "${model_label}" "${in_tokens}" "${out_tokens}"
}

# Extract EDU-XXX (or any PREFIX-NNN) from a branch ref. Echoes the match or empty.
# Examples:
#   feat/EDU-42-foo            → EDU-42
#   refs/heads/EDU-9001        → EDU-9001
#   chore/no-ticket            → ""
post_paperclip_summary::extract_issue_id_from_branch() {
  local branch="${1:-}"
  if [[ -z "${branch}" ]]; then
    return 0
  fi
  if [[ "${branch}" =~ ([A-Z]+-[0-9]+) ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
  fi
}

# Resolve the final issue id: explicit value wins, else fall back to branch parse.
# Echoes the resolved id, or empty if neither source yielded one.
post_paperclip_summary::resolve_issue_id() {
  local explicit="${1:-}"
  local branch="${2:-}"

  if [[ -n "${explicit}" ]]; then
    printf '%s' "${explicit}"
    return 0
  fi
  post_paperclip_summary::extract_issue_id_from_branch "${branch}"
}

# Read a file and trim its content to the first N chars (UTF-8 safe via head -c).
# Appends a truncation marker when the file exceeds the limit.
post_paperclip_summary::read_truncated() {
  local path="${1:-}"
  local limit="${2:-${POST_PAPERCLIP_SUMMARY_MAX_CHARS}}"

  if [[ -z "${path}" || ! -f "${path}" ]]; then
    return 0
  fi

  local size
  size=$(wc -c <"${path}" | tr -d '[:space:]')
  if [[ "${size}" -le "${limit}" ]]; then
    cat "${path}"
    return 0
  fi

  head -c "${limit}" "${path}"
  printf '\n\n_…truncated to %s chars._' "${limit}"
}

# Compose the full markdown comment body. Writes to the given path.
post_paperclip_summary::compose_body() {
  local out_path="$1"
  local pr_url="$2"
  local summary_file="$3"
  local stamp="$4"

  {
    printf '### AI code review — [edu-play-bot]\n\n'
    if [[ -n "${pr_url}" ]]; then
      printf 'PR: %s\n\n' "${pr_url}"
    fi
    if [[ -n "${summary_file}" && -f "${summary_file}" ]]; then
      post_paperclip_summary::read_truncated "${summary_file}" "${POST_PAPERCLIP_SUMMARY_MAX_CHARS}"
      printf '\n\n'
    else
      printf '_Summary file missing or empty._\n\n'
    fi
    printf -- '---\n%s\n' "${stamp}"
  } >"${out_path}"
}

# POST the comment body to Paperclip. Echoes nothing; logs on failure. Returns 0
# always — the workflow must not red-X on a missed mirror.
post_paperclip_summary::post_comment() {
  local issue_id="$1"
  local body_file="$2"
  local api_url="$3"
  local api_key="$4"
  local run_id_header="$5"

  if [[ -z "${api_key}" ]]; then
    post_paperclip_summary::log "PAPERCLIP_API_KEY missing; skipping mirror."
    return 0
  fi
  if [[ -z "${issue_id}" ]]; then
    post_paperclip_summary::log "issue id unresolved; skipping mirror."
    return 0
  fi
  if [[ ! -f "${body_file}" ]]; then
    post_paperclip_summary::log "body file ${body_file} missing; skipping mirror."
    return 0
  fi

  local payload_file
  payload_file="$(mktemp)"
  if ! jq -n --rawfile body "${body_file}" '{ comment: $body }' >"${payload_file}" 2>/dev/null; then
    post_paperclip_summary::log "jq failed to encode payload; skipping mirror."
    rm -f "${payload_file}"
    return 0
  fi

  local http_code
  http_code="$(curl -sS -o /dev/null -w '%{http_code}' \
    -X POST \
    -H "Authorization: Bearer ${api_key}" \
    -H "X-Paperclip-Run-Id: ${run_id_header}" \
    -H 'Content-Type: application/json' \
    --data-binary "@${payload_file}" \
    "${api_url}/api/issues/${issue_id}/comments" 2>/dev/null)" || http_code="000"

  rm -f "${payload_file}"

  if [[ "${http_code}" =~ ^2[0-9][0-9]$ ]]; then
    post_paperclip_summary::log "mirrored summary to ${issue_id} (HTTP ${http_code})."
  else
    post_paperclip_summary::log "mirror to ${issue_id} failed (HTTP ${http_code}); continuing."
  fi
  return 0
}

post_paperclip_summary::print_usage() {
  cat <<'USAGE' >&2
Usage: post-paperclip-summary.sh [options]
  --issue-id      Paperclip issue identifier (e.g. EDU-42). Optional; falls
                  back to parsing $GITHUB_HEAD_REF.
  --pr-url        Pull request URL to include in the comment.
  --summary-file  Path to the markdown file holding the review summary.
  --input-tokens  Integer total prompt tokens consumed by the review.
  --output-tokens Integer total completion tokens emitted by the review.
  --model         Model slug or label (e.g. claude-sonnet-4-6 or "Sonnet 4.6").
  --cost-usd      Decimal USD cost for this run (e.g. 0.04).
USAGE
}

post_paperclip_summary::main() {
  local issue_id=""
  local pr_url=""
  local summary_file=""
  local input_tokens="0"
  local output_tokens="0"
  local model=""
  local cost_usd="0"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --issue-id)      issue_id="${2:-}"; shift 2 ;;
      --pr-url)        pr_url="${2:-}"; shift 2 ;;
      --summary-file)  summary_file="${2:-}"; shift 2 ;;
      --input-tokens)  input_tokens="${2:-0}"; shift 2 ;;
      --output-tokens) output_tokens="${2:-0}"; shift 2 ;;
      --model)         model="${2:-}"; shift 2 ;;
      --cost-usd)      cost_usd="${2:-0}"; shift 2 ;;
      -h|--help)
        post_paperclip_summary::print_usage
        return 0
        ;;
      *)
        post_paperclip_summary::log "ignoring unknown flag: $1"
        shift
        ;;
    esac
  done

  local resolved_id
  resolved_id="$(post_paperclip_summary::resolve_issue_id \
    "${issue_id}" "${GITHUB_HEAD_REF:-}")"
  if [[ -z "${resolved_id}" ]]; then
    post_paperclip_summary::log \
      "no issue id from --issue-id or GITHUB_HEAD_REF='${GITHUB_HEAD_REF:-}'; nothing to mirror."
    return 0
  fi

  local stamp
  stamp="$(post_paperclip_summary::format_cost_stamp \
    "${cost_usd}" "${model}" "${input_tokens}" "${output_tokens}")"

  local body_file
  body_file="$(mktemp)"
  if ! post_paperclip_summary::compose_body \
    "${body_file}" "${pr_url}" "${summary_file}" "${stamp}"; then
    post_paperclip_summary::log "failed to compose body; skipping mirror."
    rm -f "${body_file}"
    return 0
  fi

  local api_url="${PAPERCLIP_API_URL:-${POST_PAPERCLIP_DEFAULT_API_URL}}"
  local api_key="${PAPERCLIP_API_KEY:-}"
  local run_id_header="ci-${GITHUB_RUN_ID:-local}"

  post_paperclip_summary::post_comment \
    "${resolved_id}" "${body_file}" "${api_url}" "${api_key}" "${run_id_header}"

  rm -f "${body_file}"
  return 0
}

# Only execute main when run directly. Sourcing leaves the helpers available
# for the bash test suite.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  post_paperclip_summary::main "$@"
fi
