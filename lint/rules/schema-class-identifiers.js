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

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"A Schema class's, HttpApi's, or HttpApiGroup's identifier names the class, so decode errors and API docs show the name the code uses.",
		},
	},
	create(context) {
		return {
			ClassDeclaration(node) {
				const name = node.id?.name
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
