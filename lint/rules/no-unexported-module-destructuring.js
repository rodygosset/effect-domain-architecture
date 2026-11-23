const rule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"A module-level destructuring must be exported. A local name taken out of an object hides where the value comes from, so read the member instead, such as `picker.search`.",
		},
		schema: [],
	},
	create(context) {
		return {
			VariableDeclaration(node) {
				if (node.parent.type !== "Program") return
				for (const declarator of node.declarations) {
					if (declarator.id.type !== "ObjectPattern" && declarator.id.type !== "ArrayPattern") continue
					context.report({
						node: declarator,
						message:
							"Do not destructure at module level unless you export the names. Read the member where you use it, such as `picker.search`. See docs/GUIDELINES.md, Function shape.",
					})
				}
			},
		}
	},
}

export default rule
