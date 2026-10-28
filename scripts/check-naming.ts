/**
 * Fail on file and script names that docs/NAMING.md rules out: kebab-case or snake_case files and folders, component
 * files that are not PascalCase, `index.ts` files that are not entries, vague or repeated module names, words the
 * glossary retires as whole words, tests with no module of their name beside them, hook folders outside the shared hooks
 * folder, component files not named for their export, and command-line scripts whose package script name does not match
 * the file. `architecture.config.ts` says where the code lives.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, FileSystem, Path, Schema } from "effect"
import { loadConfig } from "../config.js"
import { globMatcher, rootOf, scanGlob } from "../lint/glob.js"

/** The project's `architecture.config.ts`. */
const layout = await loadConfig()

const frontend: string | undefined = layout.frontend.root
const isExempt = globMatcher(layout.naming.exempt)
/** A workflow folder: every folder from the frontend root down is PascalCase. */
const workflowFolder =
	frontend === undefined ? /(?!)/ : new RegExp(`^${frontend.replaceAll(".", "\\.")}(/[A-Z][^/]*)+$`)
/** Files that may be named `index`: context entries, page shells, and workflow slice entries. */
const isEntry = (file: string) =>
	layout.contexts.some((context) => layout.entryFiles.some((entry) => file === `${context}/${entry}`)) ||
	(layout.frontend.pages !== undefined && globMatcher([`${layout.frontend.pages}/*/index.{ts,tsx}`])(file)) ||
	(file.endsWith("/index.ts") && workflowFolder.test(file.slice(0, -"/index.ts".length)))
/** Names that say only what kind of code a file holds. `utils.ts` stays as the shadcn convention for `cn`. */
const vagueNames = new Set([
	"helpers",
	"helper",
	"common",
	"misc",
	"types",
	"schema",
	"schemas",
	"data",
	"constants",
	"util",
	"stuff",
	"shared",
	"platform",
	"api",
	"matching",
	"seo",
])
/** File names every machine, slice, or context repeats on purpose. */
const roleNames = new Set(["index", "model", "message", "update", "runtime", "atoms", "translations", "fixtures"])
const frameworkFiles = new Set(layout.naming.frameworkFiles)

const Package = Schema.Struct({ scripts: Schema.Record(Schema.String, Schema.String) })
const decodePackage = Schema.decodeUnknownEffect(Schema.fromJsonString(Package))

const outsideWords = layout.naming.outsideWords.map((rule) => ({ term: rule.term, isIn: globMatcher(rule.files) }))
const wireNames = new Set(layout.naming.wireNames)
/** Opt in: the words every component in a `ui/` folder starts with, by folder. */
const componentPrefixes: Record<string, ReadonlyArray<string>> | undefined = layout.naming?.componentPrefixes
/** Opt in: the one folder that may group shared hooks. Any other `hooks/` folder fails. */
const sharedHooks: string | undefined = layout.naming?.sharedHooks
const orphanTests = new Set(layout.naming.orphanTests)

/** The words of a name or a phrase, lowercased: `orderLine` is order and line, `order_search_map` three words. */
const words = (text: string): Array<string> =>
	text
		.replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replaceAll(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.split(/[^A-Za-z0-9]+/)
		.filter((word) => word !== "")
		.map((word) => word.toLowerCase())
/** The runs of words in a source line. A run crosses spaces, as prose does, but not punctuation. URLs and bare HTTP
 * field names are left out. */
const lineRuns = (line: string): Array<Array<string>> =>
	line
		.replaceAll(/https?:\/\/\S+/g, "")
		.split(/[^A-Za-z0-9_$ ]+/)
		.map((run) => run.split(" ").flatMap((token) => (wireNames.has(token) ? [] : words(token))))
const singular = (word: string) => word.replace(/s$/, "")
/** Whether `term` appears as whole words, in order, inside `text`. A plural counts as the word. */
const containsWords = (text: ReadonlyArray<string>, term: ReadonlyArray<string>) =>
	text.some((_, start) => term.every((word, offset) => singular(text[start + offset] ?? "") === singular(word)))
const stem = (file: string) =>
	file
		.split("/")
		.at(-1)
		?.replace(/\.(test\.)?tsx?$/, "") ?? file
/** `importSourceRecords` becomes `import:source-records`: the verb, a colon, then the rest in kebab-case. */
const scriptName = (cli: string) => {
	const [verb = "", ...rest] = cli.split(/(?=[A-Z])/)
	return rest.length === 0 ? verb : `${verb}:${rest.join("-").toLowerCase()}`
}

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem
	const path = yield* Path.Path
	const files = layout.sourceRoots
		.flatMap((root) => scanGlob(`${root}/**/*.{ts,tsx}`, process.cwd()))
		.map((file) => file.replaceAll("\\", "/"))
		.filter((file) => !isExempt(file))
		.sort()
	if (files.length === 0)
		return yield* Effect.fail("Found no source files; the check would pass without checking anything")
	const problems: Array<string> = []

	for (const file of files) {
		const inside = file.slice((rootOf(layout.sourceRoots, file) ?? "").length + 1)
		for (const segment of inside.split("/"))
			if (/[-_]/.test(segment.replace(/\.(test\.)?tsx?$/, "")))
				problems.push(`${file}: "${segment}" uses - or _. Name files and folders in camelCase or PascalCase.`)
		if (sharedHooks !== undefined && inside.split("/").includes("hooks") && !file.startsWith(`${sharedHooks}/`))
			problems.push(
				`${file}: a hook sits beside the components that use it. Only ${sharedHooks}/ groups shared hooks in a folder.`
			)
		const name = stem(file)
		// A hook's test renders it, so it is a .tsx file named after the hook.
		if (file.endsWith(".tsx") && name !== "index" && !frameworkFiles.has(file) && !/^([A-Z]|use[A-Z])/.test(name))
			problems.push(`${file}: a component file takes its component's PascalCase name.`)
		if (name === "index" && !isEntry(file))
			problems.push(`${file}: index.ts marks a package or slice entry. Name this file for its main export.`)
		if (vagueNames.has(name.toLowerCase()))
			problems.push(
				`${file}: "${name}" says what kind of code this is, not what it holds. Name it for its main export.`
			)
	}

	const byPackage = new Map<string, Map<string, Array<string>>>()
	for (const file of files) {
		if (/\.test\.tsx?$/.test(file) || roleNames.has(stem(file))) continue
		const owner = rootOf(layout.sourceRoots, file) ?? ""
		const names = byPackage.get(owner) ?? new Map<string, Array<string>>()
		names.set(stem(file), [...(names.get(stem(file)) ?? []), file])
		byPackage.set(owner, names)
	}
	for (const names of byPackage.values())
		for (const [name, group] of names) {
			// A port and its adapters share a name on purpose: application/OrderStore.ts, infrastructure/Demo/OrderStore.ts.
			const outsideAdapters = group.filter((file) => !file.includes("/infrastructure/"))
			if (group.length > 1 && outsideAdapters.length > 1)
				problems.push(
					`${group.join(", ")}: two modules named "${name}" in one package. Name each for what it holds.`
				)
		}

	const banned = layout.glossary
		.flatMap((entry) => entry.retire.map((word) => words(word)))
		.filter((term) => term.length > 0)
		.filter((term, index, terms) => terms.findIndex((other) => other.join(" ") === term.join(" ")) === index)
	for (const file of files) {
		const text = yield* fs.readFileString(file)
		for (const term of banned) {
			const spelled = term.join(" ")
			if (outsideWords.some((rule) => rule.term === spelled && rule.isIn(file))) continue
			if (containsWords(words(file.slice((rootOf(layout.sourceRoots, file) ?? "").length + 1)), term))
				problems.push(
					`${file}: the file name uses "${spelled}", which the glossary in domain-model.json retires.`
				)
			text.split("\n").forEach((line, index) => {
				if (lineRuns(line).some((run) => containsWords(run, term)))
					problems.push(
						`${file}:${index + 1}: uses "${spelled}", which the glossary in domain-model.json retires.`
					)
			})
		}
	}

	// A folder never shares its name with a sibling file, so `./model` and `./model/x` point at related code.
	const folders = new Set(
		files.flatMap((file) =>
			file
				.split("/")
				.slice(1, -1)
				.map((_, index) =>
					file
						.split("/")
						.slice(0, index + 2)
						.join("/")
				)
		)
	)
	for (const file of files) {
		const sibling = file.replace(/\.(d\.)?tsx?$/, "")
		if (sibling !== file && !file.includes(".test.") && folders.has(sibling))
			problems.push(
				`${file}: ${sibling}/ is a folder with the same name. Rename the folder for what it holds, as Order/domain/ holds the order's domain nouns beside Order/model.ts.`
			)
	}

	// Every component in a workflow's ui/ folder starts with the folder's prefix.
	for (const file of files) {
		const folder = file.slice(0, file.lastIndexOf("/"))
		if (
			componentPrefixes === undefined ||
			frontend === undefined ||
			!file.endsWith(".tsx") ||
			file.includes(".test.") ||
			!globMatcher([`${frontend}/[A-Z]*/**/ui`, `${frontend}/[A-Z]*/**/ui/*`])(folder)
		)
			continue
		const prefixes = componentPrefixes[folder]
		if (prefixes === undefined) problems.push(`${file}: ${folder} has no prefix. Declare one in componentPrefixes.`)
		else if (!prefixes.some((prefix) => stem(file).startsWith(prefix)))
			problems.push(`${file}: components in ${folder} start with ${prefixes.join(" or ")}.`)
	}

	// A component file takes its main export's name, or names a family that every export belongs to.
	for (const file of files) {
		if (!file.endsWith(".tsx") || file.endsWith(".test.tsx") || stem(file) === "index" || frameworkFiles.has(file))
			continue
		const exported = Array.from(
			(yield* fs.readFileString(file)).matchAll(
				/^export (?:default )?(?:async )?(?:function|const|let|class) (\w+)/gm
			),
			(match) => match[1] ?? ""
		)
		const name = stem(file)
		const family = words(name).map(singular)
		const isMember = (symbol: string) => {
			const parts = words(symbol).map(singular)
			let next = 0
			for (const part of parts) if (part === family[next]) next++
			return next === family.length
		}
		// Every export counts, hooks and helpers included, so a file that exports its own name holds nothing else.
		const isMisnamed =
			exported.length === 1
				? exported[0] !== name
				: !exported.every((symbol) => symbol === name || isMember(symbol))
		if (isMisnamed)
			problems.push(
				`${file}: exports ${exported.join(", ")}. Name the file for its main export, or name exports for the family the file holds, as OrderCard.tsx holds OrderSummaryCard and OrderDetailCard.`
			)
	}

	for (const file of files) {
		const test = file.match(/^(.*)\.test\.tsx?$/)
		if (test === null || orphanTests.has(file)) continue
		const module = test[1] ?? ""
		if (!(yield* fs.exists(`${module}.ts`)) && !(yield* fs.exists(`${module}.tsx`)))
			problems.push(
				`${file}: a test sits beside the module it tests, as ${path.basename(module)}.ts. Name it for that module.`
			)
	}

	const cliFolders = layout.cliFolders.flatMap((pattern) =>
		scanGlob(`${pattern}/*.ts`, process.cwd()).map((file) => path.dirname(file))
	)
	for (const cliDirectory of new Set(cliFolders)) {
		const directory = path.dirname(path.dirname(cliDirectory))
		const manifest = path.join(directory, "package.json")
		const folder = path.relative(directory, cliDirectory)
		const scripts = (yield* decodePackage(yield* fs.readFileString(manifest))).scripts
		for (const cli of (yield* fs.readDirectory(cliDirectory)).filter((file) => /^[a-z][A-Za-z]*\.ts$/.test(file))) {
			const expected = scriptName(cli.replace(".ts", ""))
			const command = scripts[expected]
			if (command === undefined || !command.includes(`${folder}/${cli}`))
				problems.push(
					`${cliDirectory}/${cli}: package.json needs the script "${expected}": "bun ${folder}/${cli}".`
				)
		}
	}

	if (problems.length > 0) {
		for (const problem of problems) yield* Effect.logError(problem)
		return yield* Effect.fail(`Names that docs/NAMING.md rules out (${problems.length})`)
	}
	yield* Effect.log(`File names, glossary words, and script names follow docs/NAMING.md (${files.length} files).`)
})

// oxlint-disable-next-line effecttsgo/strict-effect-provide -- CLI composition root provides the platform services once before execution.
NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)))
