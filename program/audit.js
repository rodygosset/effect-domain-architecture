import path from "node:path"
import ts from "../typescript.js"
import { compileLayout } from "./layout.js"
import { auditOptionality } from "./optionality.js"
import {
	each,
	functionSignature,
	imports,
	isBooleanType,
	isConceptModule,
	isExported,
	isTest,
	moduleWords,
	name,
	origin,
	repeatsModule,
	slash,
	verbs,
} from "./syntax.js"

const browserNames = new Set([
	"window",
	"document",
	"navigator",
	"location",
	"localStorage",
	"sessionStorage",
	"fetch",
	"setTimeout",
	"setInterval",
	"requestAnimationFrame",
])
const atomCreators = new Set([
	"make",
	"family",
	"map",
	"mapResult",
	"flatMap",
	"kvs",
	"writable",
	"set",
	"update",
	"runtime",
	"fn",
	"pull",
	"swr",
	"debounce",
])
const reactivityModules = /^(Atom|AtomHttpApi|AtomRegistry|AtomRpc|Hydration|Reactivity)$/

/**
 * A slice's public entries are its entry files and any root-level module made only of re-exports, such as a separately
 * loaded view. Everything else inside another slice is private.
 */
function isPublicEntry(layout, slice, relative, source) {
	if (layout.isEntryOf(slice, relative)) return true
	if (path.posix.dirname(relative) !== slice || !source) return false
	return (
		source.statements.length > 0 &&
		source.statements.every((statement) => ts.isExportDeclaration(statement) && statement.moduleSpecifier)
	)
}

/**
 * @typedef {object} Extension A project's own typed rules. check-program builds one from each function in
 *   `program.extensions` of `architecture.config.ts`, passing it the shared program.
 * @property {(file: string) => boolean} [isPure] Marks more frontend files as pure, such as a machine's update.
 * @property {(file: string) => boolean} [isTransparent] A pure module the purity graph doesn't follow, such as
 *   generated messages that are pure when called with a locale.
 * @property {(file: string) => boolean} [isRuntimeOwned] A module a pure module may not import.
 * @property {(source: ts.SourceFile, file: string, impure: (node: ts.Node, reason: string) => void) => void} [visit]
 *   Runs once per source file, and may mark a node as impure.
 * @property {() => void} [finish] Runs after every file was visited.
 */

/**
 * Audits the program with the TypeScript checker and the resolved value-import graph. `config` is the default export of
 * `architecture.config.ts`. Each extension adds a project's own typed rules.
 */
export function auditProgram(root, config, extensions = []) {
	const layout = compileLayout(root, config)
	const { isFeature, isPackageEntry, isFrontendNamespaceModule, isRuntimeModule, predicateName } = layout
	const configPath = path.join(root, "tsconfig.json")
	const tsconfig = ts.readConfigFile(configPath, (file) => ts.sys.readFile(file))
	if (tsconfig.error) throw new Error(ts.flattenDiagnosticMessageText(tsconfig.error.messageText, "\n"))
	const parsed = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, root)
	const program = ts.createProgram(parsed.fileNames, parsed.options)
	/** A module whose one export takes the file's name, such as `notifyInvalidArea.ts`. Consumers import that export by name. */
	function isNamedForExport(file) {
		const exported = program.getSourceFile(file)?.statements.filter(isExported) ?? []
		const names = exported.flatMap((statement) =>
			ts.isVariableStatement(statement)
				? statement.declarationList.declarations.map((declaration) => name(declaration.name))
				: [name(statement.name)]
		)
		return names.length === 1 && names[0] === path.basename(file, ".ts")
	}
	const isFrontendNamespace = (file) => isFrontendNamespaceModule(file) && !isNamedForExport(file)
	const checker = program.getTypeChecker()
	const sources = program
		.getSourceFiles()
		.filter(
			(source) =>
				!source.isDeclarationFile &&
				!slash(source.fileName).includes("/node_modules/") &&
				layout.isSource(source.fileName)
		)
	const sourceByPath = new Map(sources.map((source) => [path.resolve(source.fileName), source]))
	const findings = []
	const recorded = new Set()
	function report(source, node, rule, message) {
		const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
		const file = slash(path.relative(root, source.fileName))
		const key = `${file}:${line}:${rule}:${message}`
		if (recorded.has(key)) return
		recorded.add(key)
		findings.push({ file, line, rule, message })
	}
	const plugins = extensions.map((extension) =>
		extension({ root, config, layout, program, checker, parsed, sources, sourceByPath, report })
	)
	const anyPlugin = (hook, file) => plugins.some((plugin) => plugin[hook]?.(file) === true)
	/** Domain and presentation modules in frontend slices, and the files an extension marks, hold no runtime code. */
	const isPure = (file) =>
		isFeature(file) && !isTest(file) && (/\/(domain|presentation)\//.test(slash(file)) || anyPlugin("isPure", file))
	const graph = new Map()
	const impure = new Map()
	/** Lib modules some file imports as a namespace, so their exports are read as `Money.format`. */
	const namespaceModules = new Set(
		sources.flatMap((source) =>
			source.statements.flatMap((statement) => {
				if (
					!ts.isImportDeclaration(statement) ||
					!statement.importClause?.namedBindings ||
					!ts.isNamespaceImport(statement.importClause.namedBindings) ||
					!ts.isStringLiteral(statement.moduleSpecifier)
				)
					return []
				const target = ts.resolveModuleName(
					statement.moduleSpecifier.text,
					source.fileName,
					parsed.options,
					ts.sys
				).resolvedModule?.resolvedFileName
				return target === undefined ? [] : [path.resolve(target)]
			})
		)
	)
	for (const source of sources) {
		const file = path.resolve(source.fileName)
		const rel = slash(path.relative(root, file))
		if (!isTest(file))
			for (const statement of source.statements) {
				const declarations = ts.isFunctionDeclaration(statement)
					? [statement]
					: ts.isVariableStatement(statement)
						? statement.declarationList.declarations
						: []
				for (const declaration of declarations) {
					const symbol = name(declaration.name)
					if (!symbol || predicateName.test(symbol) || /^[A-Z]/.test(symbol)) continue
					const signature = functionSignature(checker, declaration)
					if (signature && isBooleanType(checker.getReturnTypeOfSignature(signature)))
						report(
							source,
							declaration,
							"predicate-names",
							`${symbol} returns a boolean, so its name starts with is, has, or can, such as is${symbol[0].toUpperCase()}${symbol.slice(1)}. A function that changes something returns a named status instead.`
						)
				}
			}
		const pure = isPure(file)
		const edges = []
		const reasons = []
		for (const item of imports(source)) {
			if (item.specifier === undefined) {
				if (pure)
					report(source, item.node, "pure-import", "Pure modules cannot load a computed dynamic module path.")
				continue
			}
			const target = ts.resolveModuleName(item.specifier, file, parsed.options, ts.sys).resolvedModule
				?.resolvedFileName
			if (target) {
				const targetSlice = layout.sliceOf(target)
				const targetRelative = slash(path.relative(root, target))
				if (
					targetSlice &&
					targetSlice !== layout.sliceOf(file) &&
					!isPublicEntry(layout, targetSlice, targetRelative, sourceByPath.get(path.resolve(target)))
				)
					report(
						source,
						item.node,
						"public-slice-import",
						`Import ${targetSlice}'s public entry instead of ${item.specifier}; path aliases and dynamic imports obey the same boundary.`
					)
			}
			if (target && sourceByPath.has(path.resolve(target))) {
				const selected = new Set()
				if (ts.isImportDeclaration(item.node)) {
					const bindings = item.node.importClause?.namedBindings
					if (!item.node.importClause) selected.add(target)
					if (item.node.importClause?.name) selected.add(origin(checker, item.node.importClause.name)?.file)
					if (bindings && ts.isNamedImports(bindings)) {
						for (const element of bindings.elements)
							if (!element.isTypeOnly) selected.add(origin(checker, element.name)?.file)
					} else if (bindings && ts.isNamespaceImport(bindings))
						each(source, (node) => {
							if (
								(ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
								ts.isIdentifier(node.expression) &&
								checker.getSymbolAtLocation(node.expression) ===
									checker.getSymbolAtLocation(bindings.name)
							)
								selected.add(
									origin(checker, ts.isElementAccessExpression(node) ? node.argumentExpression : node)
										?.file
								)
						})
				} else if (
					ts.isExportDeclaration(item.node) &&
					item.node.exportClause &&
					ts.isNamedExports(item.node.exportClause)
				) {
					for (const element of item.node.exportClause.elements)
						if (!element.isTypeOnly) selected.add(origin(checker, element.name)?.file)
				} else selected.add(target)
				for (const ownedFile of selected)
					if (ownedFile && sourceByPath.has(path.resolve(ownedFile)))
						edges.push({ ...item, target: path.resolve(ownedFile) })
			}
			if (isRuntimeModule(item.specifier)) reasons.push({ node: item.node, message: item.specifier })
			if (/^effect\/(?:unstable\/)?reactivity(?:\/|$)/.test(item.specifier)) {
				const bindings = ts.isImportDeclaration(item.node) ? item.node.importClause?.namedBindings : undefined
				if (
					/\/(Atom|AtomHttpApi|AtomRegistry|AtomRpc|Hydration|Reactivity)(?:\.|$)/.test(item.specifier) ||
					(bindings &&
						ts.isNamedImports(bindings) &&
						bindings.elements.some(
							(element) =>
								!element.isTypeOnly &&
								reactivityModules.test(name(element.propertyName ?? element.name))
						))
				)
					reasons.push({ node: item.node, message: `HTTP reactivity module ${item.specifier}` })
			}
			if (pure && target && plugins.some((plugin) => plugin.isRuntimeOwned?.(path.resolve(target)) === true))
				report(source, item.node, "pure-import", `Pure module imports runtime-owned ${item.specifier}.`)
		}
		graph.set(file, edges)
		const presentation = isFeature(file) && !isTest(file) && /\/presentation\/[^/]+\.ts$/.test(rel)
		const libNamespace = !isTest(file) && layout.isSharedLibrary(rel) && namespaceModules.has(file)
		const conceptModule = isConceptModule(file)
		const frontendModule = !presentation && isFrontendNamespace(file)
		if (presentation || libNamespace || conceptModule || frontendModule) {
			const words = moduleWords(path.basename(file, ".ts"))
			for (const statement of source.statements) {
				const declarations = ts.isVariableStatement(statement)
					? statement.declarationList.declarations
					: ts.isFunctionDeclaration(statement) ||
						  ts.isClassDeclaration(statement) ||
						  ts.isTypeAliasDeclaration(statement) ||
						  ts.isInterfaceDeclaration(statement)
						? [statement]
						: []
				for (const declaration of declarations) {
					const symbol = name(declaration.name)
					if (!symbol) continue
					if (
						repeatsModule(symbol, words) ||
						((conceptModule || presentation || frontendModule) &&
							[...verbs].some((verb) => symbol === `${verb}${words.join("")}`))
					)
						report(
							source,
							declaration,
							"module-prefix",
							`${symbol} repeats its module name (${words.join("")}); consumers read it through the namespace, so drop the prefix.`
						)
				}
			}
		}
		for (const statement of source.statements) {
			if (
				(!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) ||
				!statement.moduleSpecifier ||
				!ts.isStringLiteral(statement.moduleSpecifier)
			)
				continue
			const target = ts.resolveModuleName(statement.moduleSpecifier.text, file, parsed.options, ts.sys)
				.resolvedModule?.resolvedFileName
			if (target === undefined) continue
			const resolved = path.resolve(target)
			const concept = isConceptModule(resolved)
			const frontendNamespace = isFrontendNamespace(resolved)
			if (!concept && !frontendNamespace) continue
			const moduleBase = path.basename(target, ".ts")
			const alias = `${moduleBase[0].toUpperCase()}${moduleBase.slice(1)}`
			const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined
			const isNamespace = ts.isImportDeclaration(statement)
				? bindings !== undefined && ts.isNamespaceImport(bindings) && !statement.importClause?.name
				: statement.exportClause !== undefined && ts.isNamespaceExport(statement.exportClause)
			if (!isNamespace)
				report(
					source,
					statement,
					"concept-namespace",
					`Read the ${moduleBase} ${concept ? "concept" : "module"} through its namespace: import * as ${alias} from "${statement.moduleSpecifier.text}", then ${alias}.member.`
				)
		}
		if (isPackageEntry(rel))
			for (const statement of source.statements)
				if (
					!ts.isExportDeclaration(statement) ||
					statement.exportClause === undefined ||
					!ts.isNamespaceExport(statement.exportClause)
				)
					report(
						source,
						statement,
						"concept-namespace",
						'A package entry only re-exports modules as namespaces: export * as Concept from "…".'
					)
		each(source, (node) => {
			if (ts.isIdentifier(node) && browserNames.has(node.text)) {
				const symbol = checker.getSymbolAtLocation(node)
				if (
					!symbol ||
					symbol.declarations?.some(
						(declaration) =>
							declaration.getSourceFile().isDeclarationFile &&
							/lib\.(dom|webworker)\./.test(declaration.getSourceFile().fileName)
					)
				)
					reasons.push({ node, message: `browser global ${node.text}` })
			}
			if (!ts.isCallExpression(node)) return
			const owned = origin(checker, node.expression)
			if (!owned) return
			const atom = /\/(?:reactivity\/)?Atom\.[^/]+$/.test(owned.file) || /\/Atom\//.test(owned.file)
			if (atom && atomCreators.has(owned.name)) reasons.push({ node, message: `Atom.${owned.name}` })
			if (/\/Effect\.[^/]+$/.test(owned.file) && owned.name.startsWith("run"))
				reasons.push({ node, message: `Effect.${owned.name}` })
		})
		for (const plugin of plugins) plugin.visit?.(source, file, (node, message) => reasons.push({ node, message }))
		impure.set(file, reasons)
		if (pure)
			for (const reason of reasons)
				report(source, reason.node, "pure-execution", `Pure module depends on ${reason.message}.`)
	}
	function impurity(file, visiting = new Set()) {
		if (visiting.has(file) || anyPlugin("isTransparent", file)) return undefined
		visiting.add(file)
		const direct = impure.get(file)?.[0]
		if (direct) return `${slash(path.relative(root, file))}: ${direct.message}`
		for (const edge of graph.get(file) ?? []) {
			const reason = impurity(edge.target, visiting)
			if (reason) return reason
		}
		return undefined
	}
	for (const source of sources) {
		const file = path.resolve(source.fileName)
		if (!isPure(file)) continue
		for (const edge of graph.get(file) ?? []) {
			const reason = impurity(edge.target)
			if (reason)
				report(source, edge.node, "transitive-purity", `Value import ${edge.specifier} reaches ${reason}.`)
		}
	}
	for (const plugin of plugins) plugin.finish?.()
	auditOptionality(
		checker,
		sources.filter((source) => !layout.isVendored(source.fileName)),
		report
	)
	return findings
}
