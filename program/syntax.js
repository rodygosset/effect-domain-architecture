import ts from "../typescript.js"

/** Helpers that check-program and its extensions share to read TypeScript syntax. */

export const slash = (file) => file.replaceAll("\\", "/")
export const isTest = (file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file)
export const isExported = (statement) =>
	statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true
/** Whether a module-level declaration holds a function, including one built by a call such as dual(…). */
export function functionSignature(checker, declaration) {
	const type = checker.getTypeAtLocation(declaration.name ?? declaration)
	const [signature] = type.getCallSignatures()
	return signature
}
export const isBooleanType = (type) =>
	(type.flags & ts.TypeFlags.BooleanLike) !== 0 ||
	(type.isUnion() && type.types.every((member) => (member.flags & ts.TypeFlags.BooleanLike) !== 0))
/** A domain concept module: one concept and its operations, read through a namespace such as `Order.make`. */
export const isConceptModule = (file) => !isTest(file) && /\/domain\/[^/]+\.ts$/.test(slash(file))
export const literal = (node) =>
	node && (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined
export const name = (node) => (node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : undefined)

export function each(node, visit) {
	visit(node)
	ts.forEachChild(node, (child) => each(child, visit))
}

export function imports(source) {
	const result = []
	each(source, (node) => {
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			if (!node.moduleSpecifier || node.isTypeOnly || node.importClause?.isTypeOnly) return
			if (
				node.importClause?.namedBindings &&
				ts.isNamedImports(node.importClause.namedBindings) &&
				!node.importClause.name &&
				node.importClause.namedBindings.elements.every((element) => element.isTypeOnly)
			)
				return
			result.push({ node, specifier: literal(node.moduleSpecifier) })
		} else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
			result.push({ node, specifier: literal(node.arguments[0]) })
		}
	})
	return result
}

/** Uses the compiler's aliases and declarations, so renaming imports does not hide ownership. */
export function origin(checker, node, seen = new Set()) {
	let symbol = checker.getSymbolAtLocation(node)
	const binding = symbol?.valueDeclaration
	if (
		binding &&
		ts.isBindingElement(binding) &&
		ts.isObjectBindingPattern(binding.parent) &&
		ts.isVariableDeclaration(binding.parent.parent) &&
		binding.parent.parent.initializer
	) {
		const key = name(binding.propertyName ?? binding.name)
		if (key) symbol = checker.getTypeAtLocation(binding.parent.parent.initializer).getProperty(key) ?? symbol
	}
	if (!symbol || seen.has(symbol)) return undefined
	seen.add(symbol)
	if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
	const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0]
	if (!declaration) return undefined
	if (
		ts.isVariableDeclaration(declaration) &&
		declaration.initializer &&
		(ts.isIdentifier(declaration.initializer) || ts.isPropertyAccessExpression(declaration.initializer))
	)
		return (
			origin(checker, declaration.initializer, seen) ?? {
				file: slash(declaration.getSourceFile().fileName),
				name: symbol.name,
			}
		)
	return { file: slash(declaration.getSourceFile().fileName), name: symbol.name }
}

export const verbs = new Set([
	"to",
	"from",
	"make",
	"maybe",
	"is",
	"has",
	"get",
	"toggle",
	"remove",
	"move",
	"decode",
	"encode",
])
/** The words a module is read under. `orderLinePage` and `OrderLine` read as Order, Line, and Page. */
export const moduleWords = (name) =>
	name
		.split(/-|(?=[A-Z])/)
		.filter((word) => word !== "")
		.map((word) => word[0].toUpperCase() + word.slice(1))

/** Whether `symbol` starts with the module's name, directly or after one conversion verb (`toCsvX`, `OrderTotal`). */
export function repeatsModule(symbol, words) {
	const parts = symbol.split(/(?=[A-Z])/)
	const minimum = Math.min(2, words.length)
	for (let length = words.length; length >= minimum; length--) {
		const candidate = words.slice(0, length)
		const at = (start) =>
			candidate.every((word, index) => (parts[start + index] ?? "").toLowerCase() === word.toLowerCase())
		if (at(0) && (parts.length > length || /^[A-Z]/.test(symbol))) return parts.length > length
		if (verbs.has(parts[0]) && at(1) && parts.length > length + 1) return true
	}
	return false
}
