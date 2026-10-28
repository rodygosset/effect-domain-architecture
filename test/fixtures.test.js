import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { loadConfig } from "../config.js"
import { auditProgram } from "../program/audit.js"

const packageRoot = path.resolve(import.meta.dirname, "..")
const oxlint = path.join(packageRoot, "node_modules/oxlint/bin/oxlint")
const fixtures = path.join(packageRoot, "fixtures")

/** The rules that fired in each file, sorted, as `{ file: [rule] }`. */
function byFile(findings) {
	const files = {}
	for (const finding of findings)
		files[finding.file] = [...new Set([...(files[finding.file] ?? []), finding.rule])].sort()
	return files
}

function lint(root) {
	const result = spawnSync("node", [oxlint, "--disable-nested-config", "--format", "json", "."], {
		cwd: root,
		encoding: "utf8",
	})
	// oxlint-disable-next-line eslint/no-restricted-properties -- oxlint's own JSON report.
	const report = JSON.parse(result.stdout)
	const crash = report.diagnostics.find((diagnostic) => diagnostic.message.startsWith("Error running JS plugin"))
	if (crash) throw new Error(crash.message)
	return report.diagnostics.map((diagnostic) => ({
		file: diagnostic.filename,
		rule: diagnostic.code.replace(/^([^(]+)\((.+)\)$/, "$1/$2"),
	}))
}

function naming(root) {
	const result = spawnSync("bun", [path.join(packageRoot, "scripts/check-naming.ts")], {
		cwd: root,
		encoding: "utf8",
	})
	return `${result.stdout}${result.stderr}`
}

/** The expected rules of each file, sorted like `byFile`. */
const sortedRules = (files) =>
	Object.fromEntries(Object.entries(files).map(([file, rules]) => [file, [...rules].sort()]))

for (const name of fs.readdirSync(fixtures)) {
	const root = path.join(fixtures, name)
	// oxlint-disable-next-line eslint/no-restricted-properties -- The fixture's expectations.
	const expected = JSON.parse(fs.readFileSync(path.join(root, "expected.json"), "utf8"))
	const process_ = globalThis.process
	const cwd = process_.cwd()
	process_.chdir(root)
	try {
		assert.deepEqual(byFile(lint(root)), sortedRules(expected.lint), `${name}: lint`)
		const config = await loadConfig(root)
		assert.deepEqual(byFile(auditProgram(root, config)), sortedRules(expected.program), `${name}: check-program`)
		const output = naming(root)
		for (const word of expected.naming)
			assert.ok(output.includes(word), `${name}: check-naming misses ${word}\n${output}`)
		if (expected.naming.length === 0) assert.ok(!output.includes("ERROR"), `${name}: check-naming\n${output}`)
	} finally {
		process_.chdir(cwd)
	}
}
process.stdout.write(`Fixtures passed: ${fs.readdirSync(fixtures).join(", ")}.\n`)
