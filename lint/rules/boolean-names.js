const instruction = /^(show|hide|include|exclude|orderBy|with|focusOn|enable|disable|allow)[A-Z]/
const functionTypes = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"])

const isBooleanAnnotation = (node) => node.typeAnnotation?.typeAnnotation?.type === "TSBooleanKeyword"

const isSchemaBoolean = (value) =>
	value.type === "MemberExpression" &&
	value.object.type === "Identifier" &&
	value.object.name === "Schema" &&
	value.property.type === "Identifier" &&
	value.property.name === "Boolean"

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"A boolean field or parameter states a fact, not an instruction: `isAreaShown`, not `showArea`.",
		},
	},
	create(context) {
		function check(node, name) {
			if (instruction.test(name))
				context.report({
					node,
					message: `\`${name}\` reads as an instruction. Name the fact with \`is\`, \`has\`, or \`can\`, as \`isAreaShown\` or \`hasLabels\`. See docs/NAMING.md#predicates-and-lookups.`,
				})
		}
		return {
			TSPropertySignature(node) {
				if (node.key.type === "Identifier" && isBooleanAnnotation(node)) check(node.key, node.key.name)
			},
			Identifier(node) {
				const parent = node.parent
				if (functionTypes.has(parent?.type) && parent.params.includes(node) && isBooleanAnnotation(node))
					check(node, node.name)
			},
			Property(node) {
				if (node.key.type === "Identifier" && isSchemaBoolean(node.value)) check(node.key, node.key.name)
			},
		}
	},
}

export default rule
