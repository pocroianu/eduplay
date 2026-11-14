#!/usr/bin/env bash
#
# Bash test suite for post-paperclip-summary.sh.
#
# Runs without bats — pure bash so the CI image only needs bash + jq + curl.
#
# Usage:
#   ./scripts/post-paperclip-summary.test.sh
#
# Exit codes: 0 = all tests pass, 1 = at least one failure.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./post-paperclip-summary.sh
source "${SCRIPT_DIR}/post-paperclip-summary.sh"

PASS=0
FAIL=0
FAILED_TESTS=()

assert_equals() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "${expected}" == "${actual}" ]]; then
    PASS=$((PASS + 1))
    printf '  ok    %s\n' "${label}"
  else
    FAIL=$((FAIL + 1))
    FAILED_TESTS+=("${label}")
    printf '  FAIL  %s\n' "${label}"
    printf '        expected: %q\n' "${expected}"
    printf '        actual:   %q\n' "${actual}"
  fi
}

assert_contains() {
  local label="$1"
  local needle="$2"
  local haystack="$3"
  if [[ "${haystack}" == *"${needle}"* ]]; then
    PASS=$((PASS + 1))
    printf '  ok    %s\n' "${label}"
  else
    FAIL=$((FAIL + 1))
    FAILED_TESTS+=("${label}")
    printf '  FAIL  %s\n' "${label}"
    printf '        expected to contain: %q\n' "${needle}"
    printf '        actual:              %q\n' "${haystack}"
  fi
}

# ---------------------------------------------------------------------------
# Issue ID resolution
# ---------------------------------------------------------------------------
echo "issue id resolution"

assert_equals "explicit --issue-id wins over branch fallback" \
  "EDU-42" \
  "$(post_paperclip_summary::resolve_issue_id "EDU-42" "feat/EDU-99-other")"

assert_equals "branch fallback when no explicit id (feat/ prefix)" \
  "EDU-42" \
  "$(post_paperclip_summary::resolve_issue_id "" "feat/EDU-42-paperclip-summary")"

assert_equals "branch fallback handles refs/heads/ prefix" \
  "EDU-9001" \
  "$(post_paperclip_summary::resolve_issue_id "" "refs/heads/EDU-9001")"

assert_equals "branch fallback handles non-EDU prefixes" \
  "PAP-7" \
  "$(post_paperclip_summary::resolve_issue_id "" "fix/PAP-7-something")"

assert_equals "no match → empty (no-ticket branch)" \
  "" \
  "$(post_paperclip_summary::resolve_issue_id "" "chore/no-ticket-here")"

assert_equals "empty inputs → empty output" \
  "" \
  "$(post_paperclip_summary::resolve_issue_id "" "")"

# ---------------------------------------------------------------------------
# Cost stamp formatting
# ---------------------------------------------------------------------------
echo "cost stamp formatting"

assert_equals "canonical Sonnet 4.6 stamp" \
  '~$0.04 · Sonnet 4.6 · 7.2K in / 1.1K out' \
  "$(post_paperclip_summary::format_cost_stamp "0.04" "claude-sonnet-4-6" 7200 1100)"

assert_equals "Opus 4.7 with larger numbers" \
  '~$0.85 · Opus 4.7 · 12.5K in / 3.4K out' \
  "$(post_paperclip_summary::format_cost_stamp "0.85" "claude-opus-4-7" 12500 3400)"

assert_equals "Haiku 4.5 with sub-K tokens rounds to 1 decimal" \
  '~$0.01 · Haiku 4.5 · 0.5K in / 0.1K out' \
  "$(post_paperclip_summary::format_cost_stamp "0.01" "claude-haiku-4-5" 500 100)"

assert_equals "fractional cost rounded to 2 decimals" \
  '~$0.04 · Sonnet 4.6 · 7.2K in / 1.1K out' \
  "$(post_paperclip_summary::format_cost_stamp "0.0438" "claude-sonnet-4-6" 7200 1100)"

assert_equals "already-friendly model label passes through" \
  '~$0.04 · Sonnet 4.6 · 7.2K in / 1.1K out' \
  "$(post_paperclip_summary::format_cost_stamp "0.04" "Sonnet 4.6" 7200 1100)"

assert_equals "unknown model falls back to raw value" \
  '~$0.04 · gpt-5 · 7.2K in / 1.1K out' \
  "$(post_paperclip_summary::format_cost_stamp "0.04" "gpt-5" 7200 1100)"

assert_equals "missing/garbage cost defaults to \$0.00" \
  '~$0.00 · Sonnet 4.6 · 7.2K in / 1.1K out' \
  "$(post_paperclip_summary::format_cost_stamp "abc" "claude-sonnet-4-6" 7200 1100)"

assert_equals "missing/garbage tokens default to 0.0K" \
  '~$0.04 · Sonnet 4.6 · 0.0K in / 0.0K out' \
  "$(post_paperclip_summary::format_cost_stamp "0.04" "claude-sonnet-4-6" "abc" "")"

# ---------------------------------------------------------------------------
# Graceful failure on missing env vars
# ---------------------------------------------------------------------------
echo "graceful failure"

# main() must always exit 0 (return 0). Run it in a subshell so set -e in the
# parent does not interfere if it is later enabled.
unset_env_run_main() {
  (
    unset PAPERCLIP_API_KEY PAPERCLIP_API_URL GITHUB_HEAD_REF GITHUB_RUN_ID
    post_paperclip_summary::main "$@" >/dev/null 2>&1
    echo "$?"
  )
}

rc="$(unset_env_run_main)"
assert_equals "main returns 0 with no args and no env" "0" "${rc}"

rc="$(unset_env_run_main --issue-id EDU-1 --cost-usd 0.04 --model claude-sonnet-4-6 --input-tokens 100 --output-tokens 50)"
assert_equals "main returns 0 even with no PAPERCLIP_API_KEY" "0" "${rc}"

# Verify that compose_body produces a body containing the stamp + status line.
body_path="$(mktemp)"
summary_path="$(mktemp)"
echo "Looks good." >"${summary_path}"
post_paperclip_summary::compose_body \
  "${body_path}" \
  "https://github.com/owner/repo/pull/123" \
  "${summary_path}" \
  '~$0.04 · Sonnet 4.6 · 7.2K in / 1.1K out'
body_contents="$(cat "${body_path}")"

assert_contains "compose_body emits status line" \
  "### AI code review — [edu-play-bot]" \
  "${body_contents}"

assert_contains "compose_body includes PR url" \
  "https://github.com/owner/repo/pull/123" \
  "${body_contents}"

assert_contains "compose_body embeds summary content" \
  "Looks good." \
  "${body_contents}"

assert_contains "compose_body appends cost stamp" \
  '~$0.04 · Sonnet 4.6 · 7.2K in / 1.1K out' \
  "${body_contents}"

# Truncation: build a 4000-char file and confirm we cap at 3000 + marker.
big_path="$(mktemp)"
python3 -c "import sys; sys.stdout.write('x' * 4000)" >"${big_path}" 2>/dev/null \
  || awk 'BEGIN { for (i = 0; i < 4000; i++) printf "x" }' >"${big_path}"

trunc_body="$(post_paperclip_summary::read_truncated "${big_path}" 3000)"
assert_contains "read_truncated appends marker when over limit" \
  "_…truncated to 3000 chars._" \
  "${trunc_body}"

rm -f "${body_path}" "${summary_path}" "${big_path}"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo
printf 'Tests: %d passed, %d failed\n' "${PASS}" "${FAIL}"
if [[ "${FAIL}" -gt 0 ]]; then
  printf 'Failed:\n'
  for t in "${FAILED_TESTS[@]}"; do
    printf '  - %s\n' "${t}"
  done
  exit 1
fi
exit 0
