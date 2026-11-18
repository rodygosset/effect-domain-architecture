const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"A resource is released with `Effect.acquireUseRelease` or `Effect.acquireRelease`, never `try`/`finally`.",
		},
	},
	create(context) {
		return {
			TryStatement(node) {
				if (node.finalizer === null) return
				context.report({
					node,
					message:
						"Do not release a resource in try/finally. Use Effect.acquireUseRelease, or Effect.acquireRelease in a scope, so the release runs on failure and interruption too.",
				})
			},
		}
	},
}

export default rule
