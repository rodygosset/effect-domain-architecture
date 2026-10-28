#!/usr/bin/env bash
# Compare by default; pass --write only after reviewing the release and dry-run.
set -euo pipefail
if [[ $# -lt 2 || $# -gt 3 ]]; then
  printf 'Usage: %s <40-character commit> <version> [--write]\n' "$0" >&2
  exit 1
fi
reference_commit="$1"
reference_version="$2"
if [[ ! "$reference_commit" =~ ^[0-9a-f]{40}$ || ! "$reference_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]]; then
  printf 'Expected an immutable commit and a package version.\n' >&2
  exit 1
fi
if [[ $# -eq 3 && "$3" != --write ]]; then
  printf 'Only --write is accepted as the third argument.\n' >&2
  exit 1
fi
repo_root="$(pwd)"
if [[ -e "$repo_root/repos/effect/.git" ]]; then
  printf 'Refusing to replace a Git checkout; repos/effect must be a source snapshot.\n' >&2
  exit 1
fi
reference_temp="$(mktemp -d "${TMPDIR:-/tmp}/effect-reference.XXXXXX")"
trap 'rm -rf "$reference_temp"' EXIT
curl --fail --location --silent --show-error "https://codeload.github.com/Effect-TS/effect/tar.gz/$reference_commit" --output "$reference_temp/upstream.tar.gz"
mkdir "$reference_temp/source"
tar -xzf "$reference_temp/upstream.tar.gz" --strip-components=1 -C "$reference_temp/source"
# Verify the archive's package version before replacing anything.
if ! rg -Fq "\"version\": \"$reference_version\"" "$reference_temp/source/packages/effect/package.json"; then
  printf 'The commit does not contain the requested Effect version.\n' >&2
  exit 1
fi
if [[ $# -eq 3 ]]; then
  rsync -a --delete "$reference_temp/source/" "$repo_root/repos/effect/"
  printf '{\n  "repository": "https://github.com/Effect-TS/effect",\n  "tag": "effect@%s",\n  "commit": "%s",\n  "version": "%s"\n}\n' "$reference_version" "$reference_commit" "$reference_version" > "$repo_root/repos/effect-reference.json"
else
  rsync -ac --delete --dry-run --itemize-changes "$reference_temp/source/" "$repo_root/repos/effect/"
fi
