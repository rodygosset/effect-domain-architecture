function isTagAccess(node) {
	if (node.type !== "MemberExpression") return false
	if (node.computed) {
		return node.property.type === "Literal" && node.property.value === "_tag"
	}
	return node.property.type === "Identifier" && node.property.name === "_tag"
}

const rule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow switch statements on _tag discriminators. Use exhaustive if chains or a Match so the compiler checks every case.",
		},
	},
	create(context) {
		return {
			SwitchStatement(node) {
				if (!isTagAccess(node.discriminant)) return
				context.report({
					node,
					message:
						"Do not switch on _tag. Use exhaustive if chains or a Match so the compiler checks every case.",
				})
			},
		}
	},
}

export default rule
