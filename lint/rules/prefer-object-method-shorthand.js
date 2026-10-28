import { isExpressionReturnBody } from "../functionShape.js"

function propertyName(node) {
	if (node.computed) return "fn"
	if (node.key.type === "Identifier") return node.key.name
	if (node.key.type === "Literal" && typeof node.key.value === "string") return node.key.value
	return "fn"
}

const rule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Object properties with a real block body use method shorthand (`{ foo(args) { … } }`). Expression-only returns use an arrow property (`{ foo: (args) => … }`).",
		},
	},
	create(context) {
		return {
			Property(node) {
				if (node.method || node.kind !== "init" || node.shorthand) return
				if (node.value.type !== "FunctionExpression" || node.value.body.type !== "BlockStatement") return
				// An expression-only body belongs to prefer-arrow-for-expression-return.
				if (isExpressionReturnBody(node.value.body)) return
				const name = propertyName(node)
				context.report({
					node: node.value,
					message: `Use method shorthand for block-bodied object functions (\`{ ${name}(…) { … } }\`), not \`${name}: function (…) { … }\`. If the body only returns an expression, use an arrow property (\`{ ${name}: (…) => … }\`) instead. See docs/GUIDELINES.md §5.`,
				})
			},
		}
	},
}

export default rule
