#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import path from "node:path"

/** Each command, and the file that runs it. Every command reads the project in the working folder. */
const commands = {
	"check-program": "program/check-program.js",
	"check-naming": "scripts/check-naming.js",
	"check-circular": "scripts/check-circular.js",
	"check-unreachable": "scripts/check-unreachable.js",
	"check-escape-hatches": "scripts/check-escape-hatches.js",
	"check-effect-docs": "scripts/check-effect-docs.js",
	"check-effect-lint": "scripts/check-effect-lint.sh",
	"check-no-claude-comments": "scripts/check-no-claude-comments.sh",
	"check-commit-message-line-length": "scripts/check-commit-message-line-length.sh",
	"fix-function-shape": "scripts/fix-function-shape.js",
	"sync-effect-reference": "scripts/sync-effect-reference.sh",
	install: "install.js",
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
const result = spawnSync(file.endsWith(".sh") ? "bash" : process.execPath, [target, ...args], { stdio: "inherit" })
process.exit(result.status ?? 1)
