import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const installer = path.resolve(import.meta.dirname, "../install.ts")
const project = fs.mkdtempSync(path.join(os.tmpdir(), "effect-domain-install-"))
const run = (...args) =>
	spawnSync("node", ["--experimental-strip-types", installer, ...args], { cwd: project, encoding: "utf8" })
const naming = path.join(project, "docs/architecture/NAMING.md")

try {
	assert.equal(run("--check").status, 1, "A project without the docs fails the check")
	assert.equal(run().status, 0, "The first install succeeds")
	assert.ok(fs.existsSync(naming), "The docs are copied")
	assert.ok(fs.existsSync(path.join(project, ".agents/skills/domain-discovery/SKILL.md")), "The skills are copied")
	assert.ok(fs.existsSync(path.join(project, "architecture.lock.json")), "The lock is written")
	assert.equal(run("--check").status, 0, "A fresh install passes the check")
	fs.appendFileSync(naming, "\nA local note.\n")
	const drift = run()
	assert.equal(drift.status, 1, "An install over a hand edit fails")
	assert.ok(drift.stderr.includes("docs/architecture/NAMING.md: changed by hand"), drift.stderr)
	assert.ok(fs.readFileSync(naming, "utf8").includes("A local note."), "The hand edit stays")
	assert.equal(run("--force").status, 0, "--force overwrites the hand edit")
	assert.ok(!fs.readFileSync(naming, "utf8").includes("A local note."), "The hand edit is gone")
} finally {
	fs.rmSync(project, { recursive: true, force: true })
}
process.stdout.write("Install passed: copy, lock, check, drift, and force.\n")
