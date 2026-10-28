#!/usr/bin/env bash
# Fail when working-tree comments address the agent instead of the reader.
set -euo pipefail
repo_root="$(pwd)"
cd "$repo_root"
matches="$(git grep -n 'CLAUDE:' -- ':!node_modules' ':!repos' ':!bun.lock' ':!scripts/check-no-claude-comments.sh' . || true)"
if [ -n "$matches" ]; then
	printf '%s\n' "$matches" >&2
	printf 'Remove CLAUDE: working comments or move the note into agent docs.\n' >&2
	exit 1
fi
printf 'No CLAUDE: working comments.\n'
