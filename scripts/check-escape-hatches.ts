/**
 * Fail when code escapes the lint rules without a recorded decision.
 *
 * - Every `eslint-disable` / `oxlint-disable` names its rules, gives a reason after ` -- `, and covers one line. A test
 *   file may instead disable a rule for the whole file, such as the inline-layer rule in a test that provides a mocked
 *   service in each case.
 * - `@ts-expect-error` gives a reason; `@ts-ignore` and `@ts-nocheck` never appear.
 * - Each file's count per suppressed rule matches the allowlist (`scripts/escape-hatches.json`), so a new suppression is a reviewed
 *   allowlist change, and a removed one must be removed there too.
 * - The registry folder holds only the shadcn registry files listed in the same allowlist, because that folder
 *   is exempt from the style and hook rules.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, FileSystem, Path, Schema } from "effect"
import { loadConfig } from "../config.js"
import { globMatcher } from "../lint/glob.js"

/** The project's `architecture.config.ts`. */
const layout = await loadConfig()

const sourceGlobs = [
	...layout.sourceRoots.map((root) => `${root}/**/*.{ts,tsx,js,jsx}`),
	"scripts/**/*.{ts,js}",
	"eslint/**/*.{ts,js}",
	"*.{ts,js}",
]
const isGenerated = globMatcher([...layout.generated, "**/node_modules/**"])
/** The allowlist, and the folder of registry files the project copies in, if it has one. */
const { allowlist: allowlistFile, folder: registryFolder }: { allowlist: string; folder?: string } = layout.registry ?? {
	allowlist: "scripts/escape-hatches.json",
}
const minimumReason = 15
/** A line comment, a block comment, or a block comment inside JSX braces. */
const lintDirective = /(?:^|\s|\{)(?:\/\/|\/\*)\s*(eslint|oxlint)-disable(-next-line|-line)?(?=\s|\*\/|$)(.*)$/
const testFile = /\.test\.tsx?$/
const tsDirective = /(?:^|\s)(?:\/\/|\/\*)\s*@(ts-expect-error|ts-ignore|ts-nocheck)\b(.*)$/

const Allowlist = Schema.Struct({
	suppressions: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Int)),
	shadcnComponents: Schema.Array(Schema.String),
})

type Counts = Map<string, Map<string, number>>

function count(counts: Counts, file: string, rule: string) {
	const rules = counts.get(file) ?? new Map<string, number>()
	rules.set(rule, (rules.get(rule) ?? 0) + 1)
	counts.set(file, rules)
}

function scan(file: string, text: string, counts: Counts, problems: Array<string>) {
	for (const [index, line] of text.split("\n").entries()) {
		const at = `${file}:${index + 1}`
		const lint = lintDirective.exec(line)
		if (lint !== null) {
			const [, tool, scope, rest = ""] = lint
			const [rulesPart = "", reason = ""] = rest.replace(/\*\/\}?\s*$/, "").split(/\s--\s/, 2)
			const rules = rulesPart
				.split(",")
				.map((rule) => rule.trim())
				.filter((rule) => rule.length > 0)
			if (scope === undefined && !testFile.test(file))
				problems.push(`${at}: ${tool}-disable covers the whole file; disable one line instead.`)
			if (rules.length === 0) problems.push(`${at}: name the rule this ${tool}-disable suppresses.`)
			if (reason.trim().length < minimumReason)
				problems.push(`${at}: give a reason after " -- " saying why this rule cannot be followed here.`)
			for (const rule of rules) count(counts, file, rule)
			continue
		}
		const ts = tsDirective.exec(line)
		if (ts === null) continue
		const [, directive, rest = ""] = ts
		if (directive !== "ts-expect-error") {
			problems.push(`${at}: @${directive} is not allowed; fix the type or use a reasoned @ts-expect-error.`)
			continue
		}
		if (rest.replace(/\*\/\}?\s*$/, "").trim().length < minimumReason)
			problems.push(`${at}: say after @ts-expect-error which error is expected and why.`)
		count(counts, file, "@ts-expect-error")
	}
}

function compare(counts: Counts, allowed: typeof Allowlist.Type.suppressions, problems: Array<string>) {
	for (const [file, rules] of counts) {
		for (const [rule, found] of rules) {
			const listed = allowed[file]?.[rule] ?? 0
			if (found > listed)
				problems.push(
					`${file}: ${found} suppression(s) of ${rule}, allowlist has ${listed}. Follow the rule; if it truly cannot apply, add the entry to ${allowlistFile} in the same change.`
				)
		}
	}
	for (const [file, rules] of Object.entries(allowed)) {
		for (const [rule, listed] of Object.entries(rules)) {
			const found = counts.get(file)?.get(rule) ?? 0
			if (found < listed)
				problems.push(
					`${file}: allowlist has ${listed} suppression(s) of ${rule}, code has ${found}. Lower the entry.`
				)
		}
	}
}

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem
	const path = yield* Path.Path
	const root = process.cwd()
	const allowlist = yield* Schema.decodeEffect(Schema.fromJsonString(Allowlist))(
		yield* fs.readFileString(path.join(root, allowlistFile))
	)

	const files = sourceGlobs
		.flatMap((pattern) => Array.from(new Bun.Glob(pattern).scanSync({ cwd: root })))
		.filter((file) => !isGenerated(file))
	const counts: Counts = new Map()
	const problems: Array<string> = []
	for (const file of new Set(files)) {
		scan(file, yield* fs.readFileString(path.join(root, file)), counts, problems)
	}
	compare(counts, allowlist.suppressions, problems)

	const components =
		registryFolder === undefined ? [] : Array.from(new Bun.Glob("*").scanSync({ cwd: path.join(root, registryFolder) }))
	const registry = new Set(allowlist.shadcnComponents)
	for (const file of components) {
		if (!registry.has(file.replace(/\.tsx?$/, "")))
			problems.push(
				`${registryFolder}/${file}: not a listed shadcn registry component. Put your own primitives outside ${registryFolder}/; add a registry component with the shadcn CLI and list it in ${allowlistFile}.`
			)
	}
	for (const name of registry) {
		if (!components.some((file) => file.replace(/\.tsx?$/, "") === name))
			problems.push(`${allowlistFile}: shadcn component "${name}" is listed but missing. Remove it.`)
	}

	if (problems.length > 0) {
		for (const problem of problems) yield* Effect.logError(problem)
		return yield* Effect.fail(`Escape hatches outside the allowlist (${problems.length})`)
	}
	const total = Array.from(counts.values()).reduce(
		(sum, rules) => sum + Array.from(rules.values()).reduce((a, b) => a + b, 0),
		0
	)
	yield* Effect.log(`${total} allowlisted suppressions; ${components.length} shadcn registry components.`)
})

// oxlint-disable-next-line effecttsgo/strict-effect-provide -- CLI composition root provides the platform services once before execution.
NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)))
