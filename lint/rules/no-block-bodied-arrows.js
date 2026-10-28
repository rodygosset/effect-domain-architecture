import { calleeOf, isNamedCallback, namedCallbacks, namedCallbacksSchema } from "../functionShape.js"

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Block-bodied arrows are forbidden. Use `function () { … }` (anonymous callback) or `function name() { … }` (named helper). Expression bodies stay arrows.",
		},
		schema: [namedCallbacksSchema],
	},
	create(context) {
		const callees = namedCallbacks(context)
		return {
			ArrowFunctionExpression(node) {
				if (node.body.type !== "BlockStatement") return
				context.report({
					node,
					message: isNamedCallback(node, callees)
						? `Do not use a block-bodied arrow here. Use a named function: \`${calleeOf(node)}(function syncFoo() { … })\`. See docs/GUIDELINES.md §5.`
						: "Do not use a block-bodied arrow. Use `function () { … }` for inline callbacks, or `function name() { … }` for named helpers. Expression-bodied arrows (`() => expr`) are fine. See docs/GUIDELINES.md §5.",
				})
			},
		}
	},
}

export default rule
