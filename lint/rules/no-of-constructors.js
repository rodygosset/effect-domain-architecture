const isFunctionValue = (value) => value?.type === "FunctionExpression" || value?.type === "ArrowFunctionExpression"

/** Effect combinators (`chunksOf`, `firstSomeOf`), `*IndexOf` queries, and `valueOf` keep their names. */
const isKept = (name) =>
	name === "valueOf" || name.endsWith("IndexOf") || name.endsWith("chunksOf") || name.endsWith("firstSomeOf")

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Do not mint *Of helpers. Pick the verb from docs/NAMING.md for what the function returns (make/from/to/decode/maybe).",
		},
	},
	create(context) {
		function check(node, name) {
			if (!name?.endsWith("Of") || isKept(name)) return
			context.report({
				node,
				message: `Do not name this \`${name}\`. \`*Of\` reads like possession; use the NAMING.md verb for what it returns (\`to…\`, \`from…\`, \`decode…\`, \`maybe…\`). Kept: Effect combinators (\`chunksOf\`, \`firstSomeOf\`), \`*IndexOf\` queries, and \`valueOf\`.`,
			})
		}
		return {
			FunctionDeclaration: (node) => check(node.id ?? node, node.id?.name),
			VariableDeclarator(node) {
				if (node.id.type === "Identifier" && isFunctionValue(node.init)) check(node.id, node.id.name)
			},
			MethodDefinition(node) {
				if (!node.computed && node.key.type === "Identifier") check(node.key, node.key.name)
			},
			Property(node) {
				if (!node.computed && node.key.type === "Identifier" && isFunctionValue(node.value))
					check(node.key, node.key.name)
			},
		}
	},
}

export default rule
