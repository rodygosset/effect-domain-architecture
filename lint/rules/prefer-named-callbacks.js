import { calleeOf, isNamedCallback, namedCallbacks, namedCallbacksSchema } from "../functionShape.js"

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Callbacks to the functions the `namedCallbacks` option lists are named, so they show in stack traces. no-block-bodied-arrows covers arrow callbacks.",
		},
		schema: [namedCallbacksSchema],
	},
	create(context) {
		const callees = namedCallbacks(context)
		return {
			FunctionExpression(node) {
				if (node.id != null || !isNamedCallback(node, callees)) return
				context.report({
					node,
					message: `Name this callback: \`${calleeOf(node)}(function syncFoo() { … })\`. See docs/GUIDELINES.md §5.`,
				})
			},
		}
	},
}

export default rule
