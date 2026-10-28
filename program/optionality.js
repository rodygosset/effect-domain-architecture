import ts from "../typescript.js"

export const ownedMessage =
	"Represent owned optional state with Option, initialized with Option.none() or Option.fromUndefinedOr at the boundary."

function isOption(type) {
	const parts = (type.isUnion() ? type.types : [type]).filter(
		(part) => (part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) === 0
	)
	return parts.length > 0 && parts.every((part) => !!part.getProperty("~effect/Option"))
}

export const isAbsent = (type) =>
	(type.isUnion() ? type.types : [type]).some(
		(part) => (part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) !== 0
	)

function nameText(node) {
	if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text
	if (ts.isPrivateIdentifier(node)) return node.text.slice(1)
	return undefined
}

const isParameterOwner = (node) =>
	ts.isFunctionDeclaration(node) ||
	ts.isFunctionExpression(node) ||
	ts.isArrowFunction(node) ||
	ts.isMethodDeclaration(node) ||
	ts.isConstructorDeclaration(node) ||
	ts.isGetAccessorDeclaration(node) ||
	ts.isSetAccessorDeclaration(node)

/**
 * Runs the type-aware absence rules over the sources the project owns:
 *
 * - `maybe-names`: a value whose type is `Option` is named `maybe…`.
 * - `owned-absence`: a `let` binding holds `Option`, never `undefined` or `null`.
 */
export function auditOptionality(checker, sources, report) {
	for (const source of sources) {
		function checkName(node) {
			const name = nameText(node)
			if (name === undefined || /^maybe[A-Z]/.test(name)) return
			if (!isOption(checker.getTypeAtLocation(node))) return
			report(
				source,
				node,
				"maybe-names",
				`Name this Option value \`maybe${name[0].toUpperCase()}${name.slice(1)}\`. Schema field and foreign API names stay unchanged.`
			)
		}
		function checkBinding(name) {
			if (ts.isIdentifier(name)) return checkName(name)
			if (ts.isArrayBindingPattern(name) || ts.isObjectBindingPattern(name))
				for (const element of name.elements) if (ts.isBindingElement(element)) checkBinding(element.name)
		}
		function visit(node) {
			if (ts.isVariableDeclaration(node)) {
				checkBinding(node.name)
				const isLet = (node.parent.flags & ts.NodeFlags.Let) !== 0
				if (isLet && ts.isIdentifier(node.name) && isAbsent(checker.getTypeAtLocation(node.name)))
					report(source, node.name, "owned-absence", ownedMessage)
			}
			if (isParameterOwner(node)) for (const parameter of node.parameters) checkBinding(parameter.name)
			if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node) || ts.isGetAccessorDeclaration(node))
				checkName(node.name)
			ts.forEachChild(node, visit)
		}
		visit(source)
	}
}
