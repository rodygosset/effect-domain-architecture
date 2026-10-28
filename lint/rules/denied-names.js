/** The identifiers a binding pattern declares, as `latitude` in `const { lat: latitude } = point`. */
function* bindings(pattern) {
	if (pattern == null) return
	if (pattern.type === "Identifier") yield pattern
	if (pattern.type === "ObjectPattern")
		for (const property of pattern.properties)
			yield* bindings(property.type === "RestElement" ? property.argument : property.value)
	if (pattern.type === "ArrayPattern") for (const element of pattern.elements) yield* bindings(element)
	if (pattern.type === "RestElement") yield* bindings(pattern.argument)
	if (pattern.type === "AssignmentPattern") yield* bindings(pattern.left)
	if (pattern.type === "TSParameterProperty") yield* bindings(pattern.parameter)
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"A declared name is not one the `names` option lists, such as a short form. Object keys and type fields keep a wire format's spelling.",
		},
		schema: [
			{
				type: "object",
				properties: { names: { type: "array", items: { type: "string" } } },
				additionalProperties: false,
			},
		],
	},
	create(context) {
		const denied = new Set(context.options[0]?.names ?? [])
		if (denied.size === 0) return {}
		function check(pattern) {
			for (const node of bindings(pattern))
				if (denied.has(node.name))
					context.report({
						node,
						message: `Do not name a value \`${node.name}\`. Spell out what it holds; wire keys keep their spelling. See docs/NAMING.md#abbreviations.`,
					})
		}
		const checkFunction = (node) => {
			check(node.id)
			node.params.forEach(check)
		}
		return {
			VariableDeclarator: (node) => check(node.id),
			FunctionDeclaration: checkFunction,
			FunctionExpression: checkFunction,
			ArrowFunctionExpression: checkFunction,
			ClassDeclaration: (node) => check(node.id),
			CatchClause: (node) => check(node.param),
			ImportSpecifier: (node) => check(node.local),
			ImportDefaultSpecifier: (node) => check(node.local),
			ImportNamespaceSpecifier: (node) => check(node.local),
		}
	},
}

export default rule
