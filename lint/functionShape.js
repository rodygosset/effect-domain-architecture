/** The name of the function a callback is passed to first, as `on` for `emitter.on(function () { … })`. */
export function calleeOf(node) {
	const parent = node.parent
	if (parent?.type !== "CallExpression" || parent.arguments[0] !== node) return undefined
	const callee = parent.callee
	if (callee.type === "Identifier") return callee.name
	if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier")
		return callee.property.name
	return undefined
}

/** Callees from a rule's `namedCallbacks` option, whose callbacks are named so they show in stack traces. */
export const namedCallbacks = (context) => new Set(context.options[0]?.namedCallbacks ?? [])

/** The first callback passed to one of `callees`. */
export const isNamedCallback = (node, callees) => callees.has(calleeOf(node) ?? "")

/** The `namedCallbacks` option, shared by the function-shape rules. */
export const namedCallbacksSchema = {
	type: "object",
	properties: { namedCallbacks: { type: "array", items: { type: "string" } } },
	additionalProperties: false,
}

/** A block whose only statement returns a value. */
export function isExpressionReturnBody(body) {
	if (body.body.length !== 1) return false
	const [only] = body.body
	return only?.type === "ReturnStatement" && only.argument != null
}

/** A declaration at the top of a module, exported or not. */
export const isModuleLevel = (node) => node.parent?.type === "Program" || node.parent?.type === "ExportNamedDeclaration"

/** The name a function is declared or assigned under, as `Card` for `const Card = () => …`. */
export function functionName(node) {
	if (node.type !== "ArrowFunctionExpression" && node.id != null) return node.id.name
	const parent = node.parent
	if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name
	if ((parent?.type === "Property" || parent?.type === "PropertyDefinition") && parent.key.type === "Identifier")
		return parent.key.name
	return undefined
}

/** A rule's `propsFunctions` option: a pattern for the names of functions that take one `props` object, if any. */
export function propsFunctions(context) {
	const pattern = context.options[0]?.propsFunctions
	return pattern === undefined ? undefined : new RegExp(pattern)
}
