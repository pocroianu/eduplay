#!/usr/bin/env bash
# Verifies that src/shared/types/database.ts matches the types produced by
# `supabase gen types typescript --local` against the migrations applied in the
# running local Supabase instance.
#
# Exits non-zero with a unified diff and remediation steps when drift is found.
# Requires a local Supabase to already be running (npm run dev:full or
# `npx supabase start`).

set -euo pipefail

TYPES_PATH="src/shared/types/database.ts"

if [[ ! -f "$TYPES_PATH" ]]; then
  echo "::error::$TYPES_PATH not found. Run this from the edu-play-core repo root." >&2
  exit 2
fi

TMP_OUT="$(mktemp)"
TMP_ERR="$(mktemp)"
cleanup() { rm -f "$TMP_OUT" "$TMP_ERR"; }
trap cleanup EXIT

echo "Generating fresh Supabase types from local database..."
if ! npx supabase gen types typescript --local > "$TMP_OUT" 2>"$TMP_ERR"; then
  # Surface the real CLI error first so CI logs show the underlying failure
  # (CLI version mismatch, connection timeout, schema introspection error)
  # before the generic "is Supabase running?" hint.
  if [[ -s "$TMP_ERR" ]]; then
    cat "$TMP_ERR" >&2
  fi
  echo "::error::Failed to run 'supabase gen types typescript --local'. Is the local Supabase running?" >&2
  echo "  Start it with 'npm run dev:full' or 'npx supabase start' before re-running this check." >&2
  exit 2
fi

# Normalize line endings before diffing — committed file is CRLF on Windows
# checkouts (Git core.autocrlf), generator output is always LF.
if diff -q <(tr -d '\r' < "$TYPES_PATH") <(tr -d '\r' < "$TMP_OUT") > /dev/null; then
  echo "OK: Supabase types are up to date."
  exit 0
fi

cat <<EOF >&2
::error::Supabase types are out of date.

The committed $TYPES_PATH does not match the schema produced by supabase/migrations/.
This usually means a migration was added without regenerating the typed schema.

To fix:
  1. Make sure your local Supabase is running:  npm run dev:full
  2. Regenerate the types:                      npm run generate:types
  3. Commit the updated $TYPES_PATH and push.

--- diff (committed vs regenerated) ---
EOF

diff -u <(tr -d '\r' < "$TYPES_PATH") <(tr -d '\r' < "$TMP_OUT") >&2 || true

exit 1
