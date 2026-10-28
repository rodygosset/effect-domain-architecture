const isToEquivalence = (callee) =>
	callee.type === "MemberExpression" &&
	!callee.computed &&
	callee.property.type === "Identifier" &&
	callee.property.name === "toEquivalence" &&
	callee.object.type === "Identifier" &&
	callee.object.name === "Schema"

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Schema.toEquivalence(this) is wrong in a static field initializer; pass the class identifier.",
		},
	},
	create(context) {
		return {
			CallExpression(node) {
				if (!isToEquivalence(node.callee)) return
				const [first] = node.arguments
				if (first?.type !== "ThisExpression") return
				context.report({
					node: first,
					message:
						"Pass the class identifier to Schema.toEquivalence (e.g. `static equals = Schema.toEquivalence(Order)`), not `this`.",
				})
			},
		}
	},
}

export default rule
