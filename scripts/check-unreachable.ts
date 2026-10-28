/**
 * Fail when a workspace package file is imported by nothing but its own tests.
 * Packages export `./*`, so Knip treats every file in them as an entry and never reports one unused.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Path } from "effect"
import { Project } from "ts-morph"
import { loadConfig } from "../config.js"
import { globMatcher } from "../lint/glob.js"

/** The project's `architecture.config.ts`. */
const layout = await loadConfig()

const normalize = (filePath: string): string => filePath.replaceAll("\\", "/")
const repoRoot = `${normalize(process.cwd())}/`
const relative = (filePath: string): string => normalize(filePath).replace(repoRoot, "")

const isPackageFile = (filePath: string): boolean =>
	globMatcher([...layout.packageRoots.map((root) => `${root}/**`), ...layout.generated.map((glob) => `!${glob}`)])(
		relative(filePath)
	)

/** Tests, declarations, and command-line entry points, which nothing imports. */
const isEntry = globMatcher(["**/*.test.{ts,tsx}", "**/*.d.ts", ...layout.cliFolders.map((folder) => `${folder}/**`)])

const program = Effect.gen(function* () {
	const path = yield* Path.Path
	const project = new Project({ tsConfigFilePath: "tsconfig.json" })
	const sources = project.getSourceFiles().filter((file) => !normalize(file.getFilePath()).includes("node_modules"))

	const imported = new Set<string>()
	for (const file of sources) {
		if (/\.test\.tsx?$/.test(file.getFilePath())) continue
		for (const target of file.getReferencedSourceFiles()) {
			if (target.getFilePath() !== file.getFilePath()) imported.add(target.getFilePath())
		}
	}

	const unreachable = sources
		.map((file) => file.getFilePath())
		.filter((filePath) => isPackageFile(filePath) && !isEntry(relative(filePath)) && !imported.has(filePath))

	if (unreachable.length > 0) {
		for (const filePath of unreachable) {
			yield* Effect.logError(`Unreachable: ${path.relative(process.cwd(), filePath)}`)
		}
		return yield* Effect.fail(`Package files imported only by tests or by nothing (${unreachable.length})`)
	}
	yield* Effect.log(`Every package file is imported by runtime code.`)
})

// oxlint-disable-next-line effecttsgo/strict-effect-provide -- CLI composition root provides the platform services once before execution.
NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)))
