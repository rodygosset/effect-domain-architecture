const rule = {
	meta: {
		type: "problem",
		docs: { description: "Arrays are sorted with Effect's `Array.sort` and an `Order`, never in place." },
	},
	create(context) {
		return {
			CallExpression(node) {
				const callee = node.callee
				if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return
				if (callee.property.name !== "sort" || callee.object.type !== "Identifier") return
				if (callee.object.name === "Array") return
				context.report({
					node,
					message:
						"Do not mutate arrays with .sort(). Use Effect Array.sort / Order, or copy first ([...xs].sort()).",
				})
			},
		}
	},
}

export default rule
