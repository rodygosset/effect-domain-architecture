import { isNamedCallback, namedCallbacks, namedCallbacksSchema } from "../functionShape.js"

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Inline and callback function expressions are anonymous, except callbacks to the functions the `namedCallbacks` option lists.",
		},
		schema: [namedCallbacksSchema],
	},
	create(context) {
		const callees = namedCallbacks(context)
		return {
			FunctionExpression(node) {
				if (node.id == null || isNamedCallback(node, callees)) return
				context.report({
					node: node.id,
					message:
						"Do not name a function expression (`function handleClick() { … }`). Use anonymous `function () { … }` inline, or extract `function handleClick() { … }` as a declaration and pass it by reference. See docs/GUIDELINES.md §5.",
				})
			},
		}
	},
}

export default rule
