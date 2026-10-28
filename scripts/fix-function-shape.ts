/**
 * Rewrites function shapes to follow the Function shape rules in docs/GUIDELINES.md. Run `bun
 * scripts/fix-function-shape.ts`.
 */
import {
	Node,
	Project,
	SyntaxKind,
	type ArrowFunction,
	type FunctionDeclaration,
	type FunctionExpression,
	type SourceFile,
} from "ts-morph"
import { Effect, Result } from "effect"
import { NodeRuntime } from "@effect/platform-node"
import { loadConfig } from "../config.js"

/** The project's `architecture.config.ts`. */
const layout = await loadConfig()

const program = Effect.gen(function* () {
	const project = new Project({
		tsConfigFilePath: "tsconfig.json",
		skipAddingFilesFromTsConfig: true,
	})

	project.addSourceFilesAtPaths([
		...layout.sourceRoots.map((root) => `${root}/**/*.{ts,tsx}`),
		...layout.vendored.map((pattern) => `!${pattern}`),
	])

	/** Names that stay `function` declarations, such as components. */
	const keptFunctions = layout.keepFunctions.map((pattern) => new RegExp(pattern))
	function isExemptName(name: string | undefined): boolean {
		if (name == null || name.length === 0) return false
		return keptFunctions.some((pattern) => pattern.test(name))
	}

	function isMethodLike(node: Node): boolean {
		const parent = node.getParent()
		if (parent == null) return false
		if (Node.isMethodDeclaration(parent) || Node.isMethodSignature(parent)) return true
		if (Node.isGetAccessorDeclaration(parent) || Node.isSetAccessorDeclaration(parent)) return true
		return false
	}

	function isExpressionReturnBody(fn: FunctionDeclaration | FunctionExpression | ArrowFunction): boolean {
		const body = fn.getBody()
		if (body == null || !Node.isBlock(body)) return false
		const statements = body.getStatements()
		if (statements.length !== 1) return false
		const only = statements[0]
		if (only == null || !Node.isReturnStatement(only)) return false
		return only.getExpression() != null
	}

	function arrowParamsText(fn: FunctionDeclaration | FunctionExpression | ArrowFunction): string {
		const typeParams = fn.getTypeParameters().map((p) => p.getText())
		const typeParamsText = typeParams.length > 0 ? `<${typeParams.join(", ")}>` : ""
		const parameters = fn.getParameters()
		const params = parameters.map((p) => p.getText()).join(", ")
		const first = parameters[0]
		const needsParens =
			parameters.length !== 1 ||
			first?.getTypeNode() != null ||
			first?.hasInitializer() === true ||
			first?.isRestParameter() === true ||
			(first?.getDecorators().length ?? 0) > 0
		const paramsText = needsParens || parameters.length !== 1 ? `(${params})` : params
		return `${typeParamsText}${paramsText}`
	}

	function returnTypeText(fn: FunctionDeclaration | FunctionExpression | ArrowFunction): string {
		const rt = fn.getReturnTypeNode()?.getText()
		return rt != null ? `: ${rt}` : ""
	}

	function toArrowFromSingleReturn(fn: FunctionDeclaration | FunctionExpression): string {
		const body = fn.getBody()
		if (body == null || !Node.isBlock(body)) throw new Error("expected block")
		const ret = body.getStatements()[0]
		if (ret == null || !Node.isReturnStatement(ret)) throw new Error("expected return")
		const expression = ret.getExpression()
		let expr = expression?.getText() ?? "undefined"
		if (expr.trimStart().startsWith("{")) {
			expr = `(${expr})`
		}
		const asyncKw = fn.isAsync() ? "async " : ""
		return `${asyncKw}${arrowParamsText(fn)}${returnTypeText(fn)} => ${expr}`
	}

	function toFunctionFromBlockArrow(arrow: ArrowFunction): string {
		const body = arrow.getBody()
		if (body == null || !Node.isBlock(body)) throw new Error("expected block")
		const asyncKw = arrow.isAsync() ? "async " : ""
		const typeParams = arrow.getTypeParameters().map((p) => p.getText())
		const typeParamsText = typeParams.length > 0 ? `<${typeParams.join(", ")}>` : ""
		const params = arrow
			.getParameters()
			.map((p) => p.getText())
			.join(", ")
		const returnType = returnTypeText(arrow)
		return `${asyncKw}function ${typeParamsText}(${params})${returnType} ${body.getText()}`
	}

	function byStartDescending<T extends Node>(nodes: Array<T>): Array<T> {
		return [...nodes].sort((a, b) => b.getStart() - a.getStart())
	}

	function fixSourceFile(sourceFile: SourceFile) {
		// Pass 1: remove names from function expressions, deepest first.
		for (const fn of byStartDescending(sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression))) {
			if (fn.wasForgotten()) continue
			const named = fn.getName()
			if (named == null) continue
			if (isMethodLike(fn)) continue
			const full = fn.getText()
			const replaced = full
				.replace(new RegExp(`^async\\s+function\\s+${named}\\b`), "async function")
				.replace(new RegExp(`^function\\s+${named}\\b`), "function")
			if (replaced !== full) fn.replaceWithText(replaced)
		}

		// Pass 2: turn single-return function declarations into const arrows.
		for (const fn of byStartDescending(sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration))) {
			if (fn.wasForgotten()) continue
			const name = fn.getName()
			if (name == null) continue
			if (isExemptName(name)) continue
			if (fn.isGenerator()) continue
			if (fn.isOverload()) continue
			if (!isExpressionReturnBody(fn)) continue

			const arrow = toArrowFromSingleReturn(fn)
			const exported = fn.hasModifier(SyntaxKind.ExportKeyword)
			const defaultExport = fn.hasModifier(SyntaxKind.DefaultKeyword)
			const replacement = defaultExport
				? `export default ${arrow}`
				: exported
					? `export const ${name} = ${arrow}`
					: `const ${name} = ${arrow}`
			fn.replaceWithText(replacement)
		}

		// Pass 3: turn single-return anonymous function expressions into arrows.
		for (const fn of byStartDescending(sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression))) {
			if (fn.wasForgotten()) continue
			if (fn.getName() != null) continue
			if (isMethodLike(fn)) continue
			if (fn.isGenerator()) continue
			if (!isExpressionReturnBody(fn)) continue
			fn.replaceWithText(toArrowFromSingleReturn(fn))
		}

		// Pass 4: turn block-bodied arrows into anonymous functions.
		for (const arrow of byStartDescending(sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction))) {
			if (arrow.wasForgotten()) continue
			const body = arrow.getBody()
			if (body == null || !Node.isBlock(body)) continue
			if (isMethodLike(arrow)) continue
			arrow.replaceWithText(toFunctionFromBlockArrow(arrow))
		}
	}

	let changed = 0
	let failed = 0
	for (const sourceFile of project.getSourceFiles()) {
		const before = sourceFile.getFullText()
		const outcome = yield* Effect.try(function () {
			fixSourceFile(sourceFile)
			return sourceFile.getFullText() !== before
		}).pipe(Effect.result)
		if (Result.isSuccess(outcome)) {
			if (outcome.success) changed += 1
		} else {
			failed += 1
			sourceFile.replaceWithText(before)
			yield* Effect.logError(`FAILED ${sourceFile.getFilePath()}: ${outcome.failure}`)
		}
	}

	project.saveSync()
	yield* Effect.log(`Updated ${changed} / ${project.getSourceFiles().length} source files (${failed} failed)`)
})

NodeRuntime.runMain(program)
