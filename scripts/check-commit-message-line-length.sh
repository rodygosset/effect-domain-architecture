#!/usr/bin/env bash
# Enforce an 80-column limit on commit message lines, mirroring Foldkit.
# Usage: check-commit-message-line-length.sh [commit-msg-file]
set -euo pipefail
max_length=80
file="${1:-}"
if [ -n "$file" ]; then
	content="$(cat "$file")"
else
	content="$(git log --format=%B -n 1 HEAD)"
fi
failures=0
while IFS= read -r line; do
	if [ "${#line}" -le "$max_length" ]; then
		continue
	fi
	case "$line" in
		*://*|Co-Authored-By:*)
			continue
			;;
	esac
	printf 'Commit message line exceeds %s columns (%s): %s\n' "$max_length" "${#line}" "$line" >&2
	failures=1
done <<< "$content"
if [ "$failures" -ne 0 ]; then
	exit 1
fi
printf 'Commit message lines fit %s columns.\n' "$max_length"
