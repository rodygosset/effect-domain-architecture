/**
 * Fail when runtime modules form an import cycle.
 * Only static imports and re-exports count: a dynamic `import()` loads after its importer has
 * evaluated, so it cannot create an evaluation-order cycle.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Path } from "effect"
import { Project } from "ts-morph"
import { loadConfig } from "../config.js"
import { globMatcher } from "../lint/glob.js"

/** The project's `architecture.config.ts`. */
const layout = await loadConfig()

const isOwnedFile = globMatcher(layout.sourceRoots.map((root) => `${root}/**`))

const repoRoot = `${process.cwd().replaceAll("\\", "/")}/`

function isRuntimeFile(filePath: string): boolean {
	const normalized = filePath.replaceAll("\\", "/")
	return normalized.startsWith(repoRoot) && isOwnedFile(normalized.slice(repoRoot.length))
}

function isSkippableTarget(filePath: string): boolean {
	const normalized = filePath.replaceAll("\\", "/")
	return normalized.includes("node_modules") || normalized.endsWith(".d.ts") || !isRuntimeFile(normalized)
}

const program = Effect.gen(function* () {
	const path = yield* Path.Path
	const project = new Project({ tsConfigFilePath: "tsconfig.json" })
	const files = project.getSourceFiles().filter((file) => isRuntimeFile(file.getFilePath()))

	const graph = new Map<string, Set<string>>()
	for (const file of files) {
		const filePath = file.getFilePath()
		const targets = new Set<string>()
		for (const declaration of file.getImportDeclarations()) {
			if (declaration.isTypeOnly()) continue
			const target = declaration.getModuleSpecifierSourceFile()
			if (target === undefined) continue
			const targetPath = target.getFilePath()
			if (targetPath === filePath || isSkippableTarget(targetPath)) continue
			targets.add(targetPath)
		}
		for (const declaration of file.getExportDeclarations()) {
			if (declaration.isTypeOnly() || !declaration.hasModuleSpecifier()) continue
			const target = declaration.getModuleSpecifierSourceFile()
			if (target === undefined) continue
			const targetPath = target.getFilePath()
			if (targetPath === filePath || isSkippableTarget(targetPath)) continue
			targets.add(targetPath)
		}
		graph.set(filePath, targets)
	}

	const cycles: Array<Array<string>> = []
	const visited = new Set<string>()
	const stack: Array<string> = []
	const onStack = new Set<string>()

	function visit(node: string): void {
		visited.add(node)
		stack.push(node)
		onStack.add(node)
		for (const next of graph.get(node) ?? []) {
			if (!visited.has(next)) {
				visit(next)
			} else if (onStack.has(next)) {
				cycles.push([...stack.slice(stack.indexOf(next)), next])
			}
		}
		stack.pop()
		onStack.delete(node)
	}

	for (const node of graph.keys()) {
		if (!visited.has(node)) visit(node)
	}

	const pretty = (filePath: string): string => path.relative(process.cwd(), filePath)
	if (cycles.length > 0) {
		for (const cycle of cycles.slice(0, 20)) {
			yield* Effect.logError(`Circular dependency: ${cycle.map(pretty).join(" -> ")}`)
		}
		return yield* Effect.fail(`Circular dependencies found (${cycles.length})`)
	}
	yield* Effect.log(`No circular dependencies in ${graph.size} runtime modules.`)
})

// oxlint-disable-next-line effecttsgo/strict-effect-provide -- CLI composition root provides the platform services once before execution.
NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)))
