function isWindowTypeof(argument) {
	return argument.type === "Identifier" && argument.name === "window"
}

function isTypeofOperand(node) {
	return node.type === "UnaryExpression" && node.operator === "typeof" && !isWindowTypeof(node.argument)
}

function isStringLiteral(node) {
	return node.type === "Literal" && node.value === "string"
}

const rule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Prefer Predicate.isString over a typeof string comparison so narrowing stays in one shared guard.",
		},
	},
	create(context) {
		return {
			BinaryExpression(node) {
				if (node.operator !== "===" && node.operator !== "!==") return
				const matches =
					(isTypeofOperand(node.left) && isStringLiteral(node.right)) ||
					(isStringLiteral(node.left) && isTypeofOperand(node.right))
				if (!matches) return
				context.report({
					node,
					message: "Use Predicate.isString instead of a typeof string comparison.",
				})
			},
		}
	},
}

export default rule
