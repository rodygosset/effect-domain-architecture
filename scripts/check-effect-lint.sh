#!/usr/bin/env bash
# Ensure the patched type-aware runner actually rejects Effect violations.
set -euo pipefail
repo_root="$(pwd)"
cd "$repo_root"
probe_file="$(mktemp "$repo_root/effect-lint-probe.XXXXXX.ts")"
probe_output="$(mktemp "${TMPDIR:-/tmp}/effect-lint-probe.XXXXXX")"
trap 'rm -f "$probe_file" "$probe_output"' EXIT
cat > "$probe_file" <<'TS'
import { Effect, Schema } from "effect"
Effect.succeed(1)
export const probeNumber = Schema.Number
export const probeFetch = fetch("https://example.com")
TS
if ./node_modules/.bin/oxlint --disable-nested-config --deny-warnings --format json "$probe_file" > "$probe_output" 2>&1; then
  printf 'Effect lint unexpectedly accepted deliberate violations.\n' >&2
  exit 1
fi
for diagnostic in 'effecttsgo(floating-effect)' 'effecttsgo(schema-number)' 'effecttsgo(global-fetch)'; do
  if ! grep -Fq "$diagnostic" "$probe_output"; then
    cat "$probe_output" >&2
    printf 'Missing expected Effect diagnostic: %s\n' "$diagnostic" >&2
    exit 1
  fi
done
printf 'Effect type-aware lint rejected floating effects, non-finite number schemas, and global fetch.\n'
