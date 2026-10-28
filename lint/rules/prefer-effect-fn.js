function isEffectGenCall(node) {
	return (
		node?.type === "CallExpression" &&
		node.callee.type === "MemberExpression" &&
		!node.callee.computed &&
		node.callee.object.type === "Identifier" &&
		node.callee.object.name === "Effect" &&
		node.callee.property.type === "Identifier" &&
		node.callee.property.name === "gen"
	)
}

const rule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Write a named function that returns Effect.gen as Effect.fn, so each call gets a span and a call-site trace.",
		},
	},
	create(context) {
		if (/\.test\.tsx?$/.test(context.filename)) return {}
		return {
			VariableDeclarator(node) {
				const init = node.init
				if (init?.type !== "ArrowFunctionExpression") return
				// A generic combinator keeps its type parameters only as a plain function.
				if (init.params.length === 0 || init.typeParameters) return
				if (!isEffectGenCall(init.body)) return
				const name = node.id.type === "Identifier" ? node.id.name : "this function"
				context.report({
					node,
					message: `Write ${name} as Effect.fn("Module.${name}")(function* (...) { … }), so its calls are traced.`,
				})
			},
		}
	},
}

export default rule
