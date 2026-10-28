/** Every union tags its cases in PascalCase, matching Message and Command tags. */
/** `Schema.TaggedUnion({ … })` or the lib helper `TaggedUnion.make({ … })`. */
function isTaggedUnionCall(node) {
	if (node?.type !== "CallExpression" || node.callee.type !== "MemberExpression") return false
	const { object, property } = node.callee
	if (property.type !== "Identifier") return false
	return (
		property.name === "TaggedUnion" ||
		(property.name === "make" && object.type === "Identifier" && object.name === "TaggedUnion")
	)
}

function propertyName(property) {
	if (property.type !== "Property" && property.type !== "TSPropertySignature") return undefined
	if (property.key.type === "Identifier") return property.key.name
	return typeof property.key.value === "string" ? property.key.value : undefined
}

const isPascalCase = (tag) => /^[A-Z][A-Za-z0-9]*$/.test(tag)

/**
 * A `_tag` inside a type argument, such as `Extract<Def, { _tag: "text" }>`, names another module's case. It declares
 * nothing.
 */
function insideTypeArguments(node) {
	for (let current = node.parent; current; current = current.parent) {
		if (current.type === "TSTypeParameterInstantiation") return true
		if (current.type === "TSTypeAliasDeclaration" || current.type === "TSInterfaceDeclaration") return false
	}
	return false
}

const rule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Union cases use PascalCase tags (`Navigate`, `Home`), whether built with Schema.TaggedUnion or written as `_tag` literals.",
		},
	},
	create(context) {
		function reportTag(node, tag, origin) {
			if (isPascalCase(tag)) return
			context.report({
				node,
				message: `${origin} case "${tag}" must be PascalCase (for example "${tag[0].toUpperCase()}${tag.slice(1)}").`,
			})
		}
		return {
			CallExpression(node) {
				if (!isTaggedUnionCall(node)) return
				const record = node.arguments[0]
				if (record?.type !== "ObjectExpression") return
				for (const property of record.properties) {
					const tag = propertyName(property)
					if (tag !== undefined) reportTag(property.key, tag, "TaggedUnion")
				}
			},
			TSPropertySignature(node) {
				if (propertyName(node) !== "_tag" || insideTypeArguments(node)) return
				const literal = node.typeAnnotation?.typeAnnotation
				if (literal?.type !== "TSLiteralType" || typeof literal.literal.value !== "string") return
				reportTag(literal, literal.literal.value, "Tagged type")
			},
			Property(node) {
				if (propertyName(node) !== "_tag" || node.parent.type !== "ObjectExpression") return
				if (node.value.type !== "Literal" || typeof node.value.value !== "string") return
				reportTag(node.value, node.value.value, "Tagged value")
			},
		}
	},
}

export default rule
