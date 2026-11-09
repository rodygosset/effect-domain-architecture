/** The call that names the class: `Schema.Class<Self>("Id")` under `(fields)`, or `HttpApi.make("Id")` under `.add(…)`. */
function namingCall(superClass) {
	let call = superClass
	while (call?.type === "CallExpression" && call.callee.type === "CallExpression") call = call.callee
	while (
		call?.type === "CallExpression" &&
		call.callee.type === "MemberExpression" &&
		call.callee.object.type === "CallExpression"
	)
		call = call.callee.object
	return call
}

/**
 * The tag of `Schema.TaggedError<Self>()("Tag", fields)`: the first argument of the call whose callee is the
 * `Schema.TaggedError<Self>()` call.
 */
function taggedErrorTag(superClass) {
	let call = superClass
	while (call?.type === "CallExpression" && call.callee.type === "CallExpression") {
		const inner = call.callee
		if (
			inner.callee.type === "MemberExpression" &&
			inner.callee.object.type === "Identifier" &&
			inner.callee.object.name === "Schema" &&
			inner.callee.property.type === "Identifier" &&
			inner.callee.property.name === "TaggedError"
		) {
			const [first] = call.arguments
			return first?.type === "Literal" && typeof first.value === "string"
				? { tag: first.value, node: first }
				: undefined
		}
		call = inner
	}
	return undefined
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"A Schema class's, HttpApi's, or HttpApiGroup's identifier names the class, and a tagged error's tag ends with its class name, so decode errors and API docs show the name the code uses.",
		},
	},
	create(context) {
		return {
			ClassDeclaration(node) {
				const name = node.id?.name
				const tagged = taggedErrorTag(node.superClass)
				if (name !== undefined && tagged !== undefined && !tagged.tag.endsWith(name))
					context.report({
						node: tagged.node,
						message: `\`${name}\` is tagged "${tagged.tag}". A tagged error's tag ends with its class name and keeps its concept's words, such as "OrderNotFound" for \`Order.NotFound\`.`,
					})
				const call = namingCall(node.superClass)
				if (name === undefined || call?.type !== "CallExpression") return
				const callee = call.callee
				if (
					callee.type !== "MemberExpression" ||
					callee.object.type !== "Identifier" ||
					callee.property.type !== "Identifier"
				)
					return
				const [first] = call.arguments
				if (first?.type !== "Literal" || typeof first.value !== "string") return
				const identifier = first.value
				const factory = `${callee.object.name}.${callee.property.name}`
				if ((factory === "Schema.Class" || factory === "Schema.ErrorClass") && !identifier.endsWith(name))
					context.report({
						node: first,
						message: `\`${name}\` is declared as "${identifier}". Use "${name}", or a name that ends with it, such as "FilterCommandPage" for \`Page\`.`,
					})
				if (factory === "HttpApi.make" && identifier !== name)
					context.report({
						node: first,
						message: `\`${name}\` is declared as "${identifier}". An HttpApi's ID is its class name: "${name}".`,
					})
				if (factory === "HttpApiGroup.make" && `${identifier}Group` !== name)
					context.report({
						node: first,
						message: `\`${name}\` is declared as "${identifier}". A group class is \`{GroupId}Group\`, so rename the class or the ID to match.`,
					})
			},
		}
	},
}

export default rule
