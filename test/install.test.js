import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const packageRoot = path.resolve(import.meta.dirname, "..")
const project = fs.mkdtempSync(path.join(os.tmpdir(), "effect-domain-install-"))

/**
 * The package as a project installs it: a copy, not a link, under `node_modules`. Node treats files there differently,
 * for example it refuses to strip types from them, so the commands must run from this copy.
 */
const installed = path.join(project, "node_modules/effect-domain-architecture")
// oxlint-disable-next-line eslint/no-restricted-properties -- package.json of this package.
const { files } = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"))
for (const file of [...files, "package.json"])
	fs.cpSync(path.join(packageRoot, file), path.join(installed, file), { recursive: true })

const run = (...args) =>
	spawnSync("node", [path.join(installed, "bin.js"), "install", ...args], { cwd: project, encoding: "utf8" })
const naming = path.join(project, "docs/architecture/NAMING.md")
const settingsFile = path.join(project, ".claude/settings.json")
const hookFile = path.join(project, ".claude/hooks/checkWriting.js")
// oxlint-disable-next-line eslint/no-restricted-properties -- The settings file this test writes.
const readSettings = () => JSON.parse(fs.readFileSync(settingsFile, "utf8"))
const stopCommands = () =>
	(readSettings().hooks?.Stop ?? []).flatMap((group) => group.hooks.map((hook) => hook.command))

/** Runs the hook on a transcript whose last turn made these tool calls, and returns its decision, if any. */
function runHook(calls, options = {}) {
	const transcript = path.join(project, "transcript.jsonl")
	const earlier = options.earlier ?? []
	const entries = [
		{ type: "user", message: { role: "user", content: "Write the guide." } },
		{ type: "assistant", message: { role: "assistant", content: earlier } },
		{ type: "user", message: { role: "user", content: [{ type: "text", text: "Now fix the bug." }] } },
		{ type: "assistant", message: { role: "assistant", content: calls } },
		{ type: "user", message: { role: "user", content: [{ type: "tool_result", content: "done" }] } },
	]
	fs.writeFileSync(transcript, entries.map((entry) => JSON.stringify(entry)).join("\n"))
	const result = spawnSync("node", [hookFile], {
		input: JSON.stringify({ transcript_path: transcript, stop_hook_active: options.isActive ?? false }),
		encoding: "utf8",
	})
	assert.equal(result.status, 0, result.stderr)
	// oxlint-disable-next-line eslint/no-restricted-properties -- The hook's own output.
	return result.stdout === "" ? undefined : JSON.parse(result.stdout)
}
const edit = (file, text) => ({ type: "tool_use", name: "Edit", input: { file_path: file, new_string: text } })
const bash = (command) => ({ type: "tool_use", name: "Bash", input: { command } })

try {
	fs.mkdirSync(path.dirname(settingsFile), { recursive: true })
	fs.writeFileSync(settingsFile, JSON.stringify({ permissions: { allow: ["Bash(ls)"] } }))
	assert.equal(run("--check").status, 1, "A project without the docs fails the check")
	assert.equal(run().status, 0, "The first install succeeds")
	assert.ok(fs.existsSync(naming), "The docs are copied")
	assert.ok(fs.existsSync(path.join(project, ".agents/skills/domain-discovery/SKILL.md")), "The skills are copied")
	assert.ok(fs.existsSync(path.join(project, "architecture.lock.json")), "The lock is written")
	assert.equal(run("--check").status, 0, "A fresh install passes the check")
	assert.ok(fs.existsSync(path.join(project, "docs/WRITING.md")), "The writing guide goes straight into docs/")
	assert.ok(
		!fs.existsSync(path.join(project, "docs/architecture/WRITING.md")),
		"The writing guide is not in docs/architecture/"
	)
	assert.ok(fs.existsSync(path.join(project, "docs/TESTING.md")), "The testing guide goes straight into docs/")
	const testing = fs.readFileSync(path.join(project, "docs/TESTING.md"), "utf8")
	assert.ok(
		testing.includes("](architecture/GUIDELINES.md#comments)"),
		"The testing guide links to the other guides in docs/architecture/"
	)
	const writingSkill = fs.readFileSync(path.join(project, ".agents/skills/writing/SKILL.md"), "utf8")
	assert.ok(writingSkill.includes("`docs/WRITING.md`"), "The writing skill names the writing guide in docs/")
	assert.ok(
		writingSkill.includes("`docs/architecture/GUIDELINES.md#comments`"),
		"The writing skill names the other guides in docs/architecture/"
	)
	const guidelines = fs.readFileSync(path.join(project, "docs/architecture/GUIDELINES.md"), "utf8")
	assert.ok(guidelines.includes("](../WRITING.md)"), "A guide links to the writing guide where the project has it")
	assert.ok(guidelines.includes("](WRITING.md)") === false, "No guide links to a writing guide beside it")
	assert.ok(fs.existsSync(hookFile), "The writing hook is copied")
	assert.deepEqual(readSettings().permissions, { allow: ["Bash(ls)"] }, "The project's own settings stay")
	assert.equal(stopCommands().length, 1, "The writing hook is registered on Stop")
	assert.ok(stopCommands()[0].includes(".claude/hooks/checkWriting.js"), "The Stop hook runs the copied script")

	const markdown = runHook([edit("docs/guide.md", "A guide.")])
	assert.equal(markdown?.decision, "block", "A turn that edits Markdown is asked to check its prose")
	assert.ok(markdown.reason.includes("docs/guide.md"), markdown.reason)
	assert.ok(markdown.reason.includes(".agents/skills/writing/SKILL.md"), markdown.reason)
	assert.equal(
		runHook([edit("src/Order.ts", "/** A customer can cancel an order until it ships. */")])?.decision,
		"block",
		"A turn that writes a doc comment is asked to check it"
	)
	assert.equal(
		runHook([bash('git commit -m "Refuse cancelling a shipped order"')])?.decision,
		"block",
		"A turn that commits is asked to check the message"
	)
	assert.equal(
		runHook([bash("gh pr create --fill")])?.decision,
		"block",
		"A turn that opens a pull request is asked to check its description"
	)
	assert.equal(runHook([edit("src/Order.ts", "const total = 0")]), undefined, "Code without prose passes")
	assert.equal(
		runHook([bash("git status")], { earlier: [edit("README.md", "Old prose.")] }),
		undefined,
		"Prose from an earlier turn doesn't count"
	)
	assert.equal(
		runHook([edit("README.md", "A guide.")], { isActive: true }),
		undefined,
		"The hook asks once, so the agent can finish after the check"
	)

	fs.appendFileSync(naming, "\nA local note.\n")
	const drift = run()
	assert.equal(drift.status, 1, "An install over a hand edit fails")
	assert.ok(drift.stderr.includes("docs/architecture/NAMING.md: changed by hand"), drift.stderr)
	assert.ok(fs.readFileSync(naming, "utf8").includes("A local note."), "The hand edit stays")
	assert.equal(run("--force").status, 0, "--force overwrites the hand edit")
	assert.ok(!fs.readFileSync(naming, "utf8").includes("A local note."), "The hand edit is gone")
	assert.equal(stopCommands().length, 1, "A second install doesn't register the hook twice")
	fs.writeFileSync(settingsFile, JSON.stringify({ hooks: {} }))
	assert.equal(run("--check").status, 1, "The check fails when the writing hook isn't registered")
} finally {
	fs.rmSync(project, { recursive: true, force: true })
}
process.stdout.write("Install passed: copy, guide paths, writing hook, lock, check, drift, and force.\n")
