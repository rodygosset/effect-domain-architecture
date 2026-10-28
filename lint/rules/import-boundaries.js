import path from "node:path"
import ts from "../../typescript.js"
import { relativeFile } from "../files.js"
import { globToRegExp } from "../glob.js"

const asList = (value) => (Array.isArray(value) ? value : [value])

function compile(options) {
	return {
		elements: options.elements.map((element) => ({
			type: element.type,
			pattern: globToRegExp(element.pattern),
			capture: element.capture ?? [],
		})),
		ignore: (options.ignore ?? []).map(globToRegExp),
		rules: options.rules.map((rule) => ({
			from: { type: asList(rule.from.type), captured: rule.from.captured ?? {} },
			allow: asList(rule.allow).map((target) => ({ type: asList(target.type), captured: target.captured ?? {} })),
		})),
	}
}

/** The first element whose pattern matches the file, with the wildcards its `capture` names. */
function elementOf(elements, file) {
	for (const element of elements) {
		const match = element.pattern.exec(file)
		if (match === null) continue
		const captured = Object.fromEntries(element.capture.map((name, index) => [name, match[index + 1] ?? ""]))
		return { type: element.type, path: file, captured }
	}
	return undefined
}

/** `{{from.context}}` reads a value the importing element captured. */
const expand = (value, from) => value.replaceAll(/\{\{\s*from\.(\w+)\s*\}\}/g, (_, name) => from.captured[name] ?? "")

const matches = (selector, element, from) =>
	selector.type.includes(element.type) &&
	Object.entries(selector.captured).every(([name, value]) => element.captured[name] === expand(value, from))

const isAllowed = (rules, from, to) =>
	rules.some((rule) => matches(rule.from, from, from) && rule.allow.some((target) => matches(target, to, from)))

const resolvers = new Map()

/** Resolves specifiers with the `paths` of the `tsconfig.json` beside `.oxlintrc.json`. */
function resolverFor(cwd) {
	const cached = resolvers.get(cwd)
	if (cached !== undefined) return cached
	const configPath = path.join(cwd, "tsconfig.json")
	const config = ts.readConfigFile(configPath, (file) => ts.sys.readFile(file))
	const { options } = ts.parseJsonConfigFileContent(config.config ?? {}, ts.sys, cwd)
	const cache = ts.createModuleResolutionCache(cwd, (file) => file, options)
	function resolve(specifier, containingFile) {
		const resolved = ts.resolveModuleName(specifier, containingFile, options, ts.sys, cache).resolvedModule
		if (resolved === undefined || resolved.isExternalLibraryImport) return undefined
		return path.relative(cwd, resolved.resolvedFileName).replaceAll("\\", "/")
	}
	resolvers.set(cwd, resolve)
	return resolve
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Each file belongs to an element type, and an import may only cross from one type to another where a rule allows it.",
		},
		schema: false,
	},
	create(context) {
		const options = context.options[0]
		if (options === undefined) return {}
		const { elements, ignore, rules } = compile(options)
		const file = relativeFile(context)
		if (ignore.some((pattern) => pattern.test(file))) return {}
		const from = elementOf(elements, file)
		if (from === undefined) return {}
		const resolve = resolverFor(context.cwd)
		function check(node, source) {
			if (source?.type !== "Literal" || typeof source.value !== "string") return
			const target = resolve(source.value, context.filename)
			if (target === undefined || ignore.some((pattern) => pattern.test(target))) return
			const to = elementOf(elements, target)
			if (to === undefined || isAllowed(rules, from, to)) return
			context.report({
				node,
				message: `Import boundary: ${from.type} cannot import ${to.type} (${from.path} → ${to.path}). See docs/CONTEXTS.md.`,
			})
		}
		return {
			ImportDeclaration: (node) => check(node, node.source),
			ExportNamedDeclaration: (node) => check(node, node.source),
			ExportAllDeclaration: (node) => check(node, node.source),
			ImportExpression: (node) => check(node, node.source),
		}
	},
}

export default rule
