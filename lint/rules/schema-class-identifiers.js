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

/** Schema factories whose classes are errors, so their names end with `Error`. */
const errorFactories = new Set(["Schema.TaggedError", "Schema.Error", "Schema.ErrorClass"])
/** Schema factories whose classes are data, so their names never end with `Error`. */
const dataFactories = new Set(["Schema.Class", "Schema.TaggedClass"])

/** `Schema.TaggedError` for `Schema.TaggedError<Self>()("Tag", fields)`: the factory the class chain starts from. */
function factoryOf(superClass) {
	let call = superClass
	while (call?.type === "CallExpression") {
		const callee = call.callee
		if (
			callee.type === "MemberExpression" &&
			callee.object.type === "Identifier" &&
			callee.property.type === "Identifier"
		)
			return `${callee.object.name}.${callee.property.name}`
		call = callee.type === "MemberExpression" ? callee.object : callee
	}
	return undefined
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"A Schema class's, HttpApi's, or HttpApiGroup's identifier names the class, a tagged error's tag ends with its class name, and only an error class's name ends with Error, so decode errors, API docs and code show one name and a reader tells an error from data.",
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
						message: `\`${name}\` is tagged "${tagged.tag}". A tagged error's tag ends with its class name and keeps its concept's words, such as "OrderNotFoundError" for \`Order.NotFoundError\`.`,
					})
				const factory = factoryOf(node.superClass)
				if (name !== undefined && errorFactories.has(factory) && (!name.endsWith("Error") || name === "Error"))
					context.report({
						node: node.id,
						message: `\`${name}\` is an error, so its name ends with Error, such as \`Order.NotFoundError\`. A reader then tells a rejection from data where it is yielded, caught or listed.`,
					})
				if (name !== undefined && dataFactories.has(factory) && name.endsWith("Error"))
					context.report({
						node: node.id,
						message: `\`${name}\` is data, not an error, so its name doesn't end with Error. Build an error with Schema.TaggedError.`,
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
				const namingFactory = `${callee.object.name}.${callee.property.name}`
				if (
					(namingFactory === "Schema.Class" ||
						namingFactory === "Schema.ErrorClass" ||
						namingFactory === "Schema.Error") &&
					!identifier.endsWith(name)
				)
					context.report({
						node: first,
						message: `\`${name}\` is declared as "${identifier}". Use "${name}", or a name that ends with it, such as "FilterCommandPage" for \`Page\`.`,
					})
				if (namingFactory === "HttpApi.make" && identifier !== name)
					context.report({
						node: first,
						message: `\`${name}\` is declared as "${identifier}". An HttpApi's ID is its class name: "${name}".`,
					})
				if (namingFactory === "HttpApiGroup.make" && `${identifier}Group` !== name)
					context.report({
						node: first,
						message: `\`${name}\` is declared as "${identifier}". A group class is \`{GroupId}Group\`, so rename the class or the ID to match.`,
					})
			},
		}
	},
}

export default rule
