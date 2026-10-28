#!/usr/bin/env bun
import { spawnSync } from "node:child_process"
import path from "node:path"

/** Each command, and the file that runs it. Every command reads the project in the working folder. */
const commands = {
	"check-program": "program/check-program.js",
	"check-naming": "scripts/check-naming.ts",
	"check-circular": "scripts/check-circular.ts",
	"check-unreachable": "scripts/check-unreachable.ts",
	"check-escape-hatches": "scripts/check-escape-hatches.ts",
	"check-effect-docs": "scripts/check-effect-docs.ts",
	"check-effect-lint": "scripts/check-effect-lint.sh",
	"check-no-claude-comments": "scripts/check-no-claude-comments.sh",
	"check-commit-message-line-length": "scripts/check-commit-message-line-length.sh",
	"fix-function-shape": "scripts/fix-function-shape.ts",
	"sync-effect-reference": "scripts/sync-effect-reference.sh",
	install: "install.ts",
}

const [command, ...args] = process.argv.slice(2)
const file = commands[command ?? ""]
if (file === undefined) {
	process.stderr.write(
		`Usage: effect-domain <command>\n\nCommands:\n${Object.keys(commands)
			.map((name) => `  ${name}`)
			.join("\n")}\n`
	)
	process.exit(1)
}
const target = path.join(import.meta.dirname, file)
const result = spawnSync(file.endsWith(".sh") ? "bash" : "bun", [target, ...args], { stdio: "inherit" })
process.exit(result.status ?? 1)
