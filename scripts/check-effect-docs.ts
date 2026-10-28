/**
 * Check the pinned runtime, installed packages, immutable reference, and links in the agent docs. A repo path written in
 * backticks must exist too: a `*` pattern must match a file, and `{a,b}` expands. `architecture.config.ts` lists the folders such a
 * path starts from.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, FileSystem, Option, Path, Schema } from "effect"
import { loadConfig } from "../config.js"

/** The project's `architecture.config.ts`. */
const layout = await loadConfig()

/** Each Effect package, and the workspace that installs it. */
const runtimePackages: ReadonlyArray<readonly [string, string]> = Object.entries(layout.effect.packages)
/** Files of the vendored Effect source that agents read, so a sync that drops one fails. */
const requiredSourcePaths: ReadonlyArray<string> = layout.effect.requiredSources ?? [
	"repos/effect/packages/effect/src/Schema.ts",
]
const agentDocGlobs = [
	"{AGENTS,CONTEXT,README}.md",
	"docs/**/*.md",
	".agents/skills/**/*.md",
	".claude/skills/*/{SKILL,features/*}.md",
	".cursor/{commands,skills}/**/*.md",
] as const
const markdownLink = /\]\(([^)\s]+)\)/g
const shortRoots: Record<string, string> = layout.docs.shortRoots
/** A backticked path from the repo root, or from a short root. Paths inside a slice, such as `ui/Results/Card.tsx`, are
 * examples, not checked. */
const backtickedPath = new RegExp(
	`\`((?:${[...layout.docs.pathRoots, ...Object.keys(shortRoots)].map((root) => root.replaceAll(".", "\\.")).join("|")})/[^\`\\s]*)\``,
	"g"
)
/** Docs write paths under a short root without its parent, as `Orders/Checkout/update.ts`. */
const fromRoot = (written: string) => {
	const parent = shortRoots[written.split("/")[0] ?? ""]
	return parent === undefined ? written : `${parent}/${written}`
}
/** `a/{b,c}.ts` becomes `a/b.ts` and `a/c.ts`. */
const expandBraces = (pattern: string): Array<string> => {
	const match = pattern.match(/\{([^{}]*)\}/)
	if (match === null) return [pattern]
	return (match[1] ?? "").split(",").flatMap((choice) => expandBraces(pattern.replace(match[0], choice)))
}
const toAnchor = (heading: string) =>
	heading
		.trim()
		.toLowerCase()
		.replaceAll(/[^a-z0-9 -]/g, "")
		.replaceAll(" ", "-")
const headingAnchors = (text: string) =>
	new Set(Array.from(text.matchAll(/^#{1,6} (.+)$/gm), (match) => toAnchor(match[1] ?? "")))
const PackageJson = Schema.Struct({
	version: Schema.OptionFromOptional(Schema.String),
	workspaces: Schema.OptionFromOptional(Schema.Struct({ catalog: Schema.Record(Schema.String, Schema.String) })),
})
const Reference = Schema.Struct({
	repository: Schema.String,
	tag: Schema.String,
	commit: Schema.String,
	version: Schema.String,
})
const readPackageJson = Effect.fn("checkEffectDocs.readPackageJson")(function* (filename: string) {
	const fs = yield* FileSystem.FileSystem
	return yield* Schema.decodeEffect(Schema.fromJsonString(PackageJson))(yield* fs.readFileString(filename))
})
const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem
	const path = yield* Path.Path
	const root = process.cwd()
	const pkg = yield* readPackageJson(path.join(root, "package.json"))
	const reference = yield* Schema.decodeEffect(Schema.fromJsonString(Reference))(
		yield* fs.readFileString(path.join(root, "repos/effect-reference.json"))
	)
	if (
		reference.repository !== "https://github.com/Effect-TS/effect" ||
		reference.tag !== `effect@${reference.version}` ||
		!/^[0-9a-f]{40}$/.test(reference.commit)
	) {
		return yield* Effect.fail("Invalid immutable Effect source reference")
	}
	for (const [name, owner] of runtimePackages) {
		const declared = Option.flatMap(pkg.workspaces, (workspaces) =>
			Option.fromUndefinedOr(workspaces.catalog[name])
		)
		if (Option.isNone(declared) || declared.value !== reference.version) {
			const shown = Option.getOrElse(declared, () => "missing")
			return yield* Effect.fail(`${name}: catalog ${shown} must exactly match reference ${reference.version}`)
		}
		const installedPath = yield* Effect.try(() => Bun.resolveSync(`${name}/package.json`, path.join(root, owner)))
		const installed = yield* readPackageJson(installedPath)
		if (Option.isNone(installed.version) || installed.version.value !== declared.value) {
			const shown = Option.getOrElse(installed.version, () => "missing")
			return yield* Effect.fail(`${name}: installed ${shown} differs from catalog ${declared.value}`)
		}
	}
	const vendored = yield* readPackageJson(path.join(root, "repos/effect/packages/effect/package.json"))
	if (Option.isNone(vendored.version) || vendored.version.value !== reference.version) {
		const shown = Option.getOrElse(vendored.version, () => "missing")
		return yield* Effect.fail(`Vendored Effect ${shown} differs from reference ${reference.version}`)
	}
	for (const relative of requiredSourcePaths) {
		if (!(yield* fs.exists(path.join(root, relative))))
			return yield* Effect.fail(`Missing required path: ${relative}`)
	}
	const docs = agentDocGlobs.flatMap((pattern) =>
		Array.from(new Bun.Glob(pattern).scanSync({ cwd: root, dot: true }))
	)
	const missingPaths: Array<string> = []
	for (const doc of docs) {
		const text = yield* fs.readFileString(path.join(root, doc))
		for (const [, written = ""] of text.matchAll(backtickedPath)) {
			// A path that trails off (`…`, `<id>`) names its folder; a `:line` suffix points into the file.
			const trimmed = fromRoot(written)
				.replace(/(…|<).*$/, "")
				.replace(/:\d+$/, "")
			for (const candidate of expandBraces(trimmed)) {
				const found = candidate.includes("*")
					? Array.from(new Bun.Glob(candidate).scanSync({ cwd: root, dot: true })).length > 0
					: yield* fs.exists(path.join(root, candidate))
				if (!found) missingPaths.push(`${doc}: \`${written}\` names a path that does not exist`)
				if (!found) break
			}
		}
		for (const [, target = ""] of text.matchAll(markdownLink)) {
			if (/^[a-z]+:/.test(target)) continue
			const [file = "", anchor] = target.split("#")
			const resolved = file === "" ? path.join(root, doc) : path.resolve(root, path.dirname(doc), file)
			if (!(yield* fs.exists(resolved))) return yield* Effect.fail(`${doc}: broken link ${target}`)
			if (anchor === undefined || !resolved.endsWith(".md")) continue
			if (!headingAnchors(yield* fs.readFileString(resolved)).has(anchor))
				return yield* Effect.fail(`${doc}: missing anchor ${target}`)
		}
	}
	if (missingPaths.length > 0) {
		for (const missing of missingPaths) yield* Effect.logError(missing)
		return yield* Effect.fail(`Agent docs name ${missingPaths.length} paths that do not exist`)
	}
	yield* Effect.log(
		`Effect ${reference.version}: all ${runtimePackages.length} runtime packages, installed dependencies, and reference agree; ${docs.length} agent docs have no broken links or missing paths`
	)
})

// oxlint-disable-next-line effecttsgo/strict-effect-provide -- CLI composition root provides the platform services once before execution.
NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)))
