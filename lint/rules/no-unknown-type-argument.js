/** Whether `node` sits in the `extends` bound of a type parameter, where `unknown` means any value. */
const isInBound = (node) => {
	for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent)
		if (parent.type === "TSTypeParameter" && parent.constraint === child) return true
	return false
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"`unknown` as a type argument, such as `Option.Option<unknown>`, erases the type the generic carries. Take a type parameter instead. A type parameter's `extends` bound may still say `unknown`.",
		},
		schema: [],
	},
	create(context) {
		return {
			TSUnknownKeyword(node) {
				if (node.parent.type !== "TSTypeParameterInstantiation" || isInBound(node)) return
				context.report({
					node,
					message:
						"Do not pass `unknown` as a type argument: it erases what the generic carries. Take a type parameter, or name the type. See docs/GUIDELINES.md, Types.",
				})
			},
		}
	},
}

export default rule
