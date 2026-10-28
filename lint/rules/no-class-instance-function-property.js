const propertyName = (key) =>
	key.type === "Identifier"
		? key.name
		: key.type === "Literal" && typeof key.value === "string"
			? key.value
			: "<property>"

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Instance arrow or function properties on classes become own enumerable fields and break Schema.toEquivalence. Use a method instead.",
		},
	},
	create(context) {
		return {
			PropertyDefinition(node) {
				if (node.static || node.value == null) return
				if (node.value.type !== "ArrowFunctionExpression" && node.value.type !== "FunctionExpression") return
				const name = propertyName(node.key)
				context.report({
					node,
					message: `Do not assign an instance arrow/function property on a class (\`${name} = () => …\`). Use a method (\`${name}() { … }\`) so Schema.toEquivalence / structural equality stay correct.`,
				})
			},
		}
	},
}

export default rule
