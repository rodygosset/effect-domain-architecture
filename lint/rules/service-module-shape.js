/** `Context.Service<Self, Shape>()("key", …)`: the innermost call of a class's `extends` clause. */
function contextServiceCall(superClass) {
	let call = superClass
	while (call?.type === "CallExpression" && call.callee.type === "CallExpression") call = call.callee
	if (call?.type !== "CallExpression") return undefined
	const callee = call.callee
	return callee.type === "MemberExpression" &&
		callee.object.type === "Identifier" &&
		callee.object.name === "Context" &&
		callee.property.type === "Identifier" &&
		callee.property.name === "Service"
		? call
		: undefined
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"A service module exports `Shape` and one `Context.Service` class named `Service`, or `Client` for an HTTP client. See docs/NAMING.md#services.",
		},
	},
	create(context) {
		const isTest = /\.test\.tsx?$/.test(context.filename)
		const services = []
		let exportsShape = false
		return {
			ExportNamedDeclaration(node) {
				const declaration = node.declaration
				if (
					(declaration?.type === "TSInterfaceDeclaration" ||
						declaration?.type === "TSTypeAliasDeclaration") &&
					declaration.id.name === "Shape"
				)
					exportsShape = true
			},
			ClassDeclaration(node) {
				const call = contextServiceCall(node.superClass)
				if (call === undefined) return
				if (isTest && node.parent?.type !== "ExportNamedDeclaration") return
				services.push(node)
				const name = node.id?.name
				if (name !== "Service" && name !== "Client")
					context.report({
						node: node.id ?? node,
						message: `Name this Context.Service class Service, or Client for an HTTP client, and read it as ${name}.Service through the module namespace.`,
					})
				if (node.parent?.type !== "ExportNamedDeclaration")
					context.report({
						node,
						message: "Export the Context.Service class so consumers read it through the module namespace.",
					})
				const shape = (call.typeArguments ?? call.typeParameters)?.params?.[1]
				if (
					shape?.type !== "TSTypeReference" ||
					shape.typeName.type !== "Identifier" ||
					shape.typeName.name !== "Shape"
				)
					context.report({
						node: shape ?? call,
						message: "Type the service with the module's Shape: Context.Service<Service, Shape>().",
					})
			},
			"Program:exit"() {
				if (services.length > 1)
					context.report({
						node: services[1],
						message: "A module holds one service. Move this one to its own module.",
					})
				if (services.length > 0 && !exportsShape)
					context.report({
						node: services[0],
						message: "A service module exports `interface Shape`, the service's methods.",
					})
			},
		}
	},
}

export default rule
