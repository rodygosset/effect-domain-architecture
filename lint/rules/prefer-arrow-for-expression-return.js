import { isExpressionReturnBody, isNamedCallback, namedCallbacks } from "../functionShape.js"

function propertyName(node) {
	const parent = node.parent
	if (parent?.type !== "Property" || parent.computed) return null
	if (parent.key.type === "Identifier") return parent.key.name
	if (parent.key.type === "Literal" && typeof parent.key.value === "string") return parent.key.value
	return null
}

const rule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Helpers that only `return` an expression are arrows, object properties included. Class methods, and functions whose names match the `keepFunctions` patterns, keep `function` and a block body.",
		},
		schema: [
			{
				type: "object",
				properties: {
					keepFunctions: { type: "array", items: { type: "string" } },
					namedCallbacks: { type: "array", items: { type: "string" } },
				},
				additionalProperties: false,
			},
		],
	},
	create(context) {
		const kept = (context.options[0]?.keepFunctions ?? []).map((pattern) => new RegExp(pattern))
		const callees = namedCallbacks(context)
		const isKept = (name) => name != null && kept.some((pattern) => pattern.test(name))
		function reportIfNeeded(node, name) {
			if (node.generator === true || node.parent?.type === "MethodDefinition") return
			if (isNamedCallback(node, callees) || node.body?.type !== "BlockStatement") return
			if (!isExpressionReturnBody(node.body) || isKept(name)) return
			context.report({
				node,
				message: `This function only returns an expression — use an arrow (\`const ${name ?? "fn"} = (…) => …\`, \`(…) => …\`, or object \`{ ${name ?? "fn"}: (…) => … }\`). See docs/GUIDELINES.md §5.`,
			})
		}
		return {
			FunctionDeclaration: (node) => reportIfNeeded(node, node.id?.name ?? null),
			FunctionExpression(node) {
				if (node.id != null && !isNamedCallback(node, callees)) return
				reportIfNeeded(node, propertyName(node) ?? node.id?.name ?? null)
			},
		}
	},
}

export default rule
