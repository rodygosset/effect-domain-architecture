const mutators = new Set([
	"push",
	"pop",
	"shift",
	"unshift",
	"splice",
	"sort",
	"reverse",
	"fill",
	"copyWithin",
	"set",
	"add",
	"delete",
	"clear",
])
const globals = new Set(["window", "globalThis", "self"])

const isTestFile = (filename) => /\.(test|spec)\.tsx?$/.test(filename)

function declaredNames(pattern, names) {
	if (pattern.type === "Identifier") names.add(pattern.name)
	if (pattern.type === "ObjectPattern")
		for (const property of pattern.properties)
			declaredNames(property.type === "RestElement" ? property.argument : property.value, names)
	if (pattern.type === "ArrayPattern")
		for (const element of pattern.elements) if (element) declaredNames(element, names)
	if (pattern.type === "RestElement") declaredNames(pattern.argument, names)
	if (pattern.type === "AssignmentPattern") declaredNames(pattern.left, names)
}

function rootIdentifier(node) {
	let current = node
	while (current.type === "MemberExpression") current = current.object
	return current.type === "Identifier" ? current.name : undefined
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Modules hold no mutable state: no module-scope let or var, no mutation of module-scope values, no writes to window or globalThis. State lives in the value or instance that owns it.",
		},
	},
	create(context) {
		if (isTestFile(context.filename)) return {}
		const moduleNames = new Set()
		function report(node, what) {
			context.report({
				node,
				message: `${what} is module state that every importer shares. Keep it in the value, state, or instance that owns it.`,
			})
		}
		function checkTarget(node, target) {
			if (target.type !== "MemberExpression") return
			const root = rootIdentifier(target)
			if (root !== undefined && (moduleNames.has(root) || globals.has(root))) report(node, `Writing to ${root}`)
		}
		return {
			Program(program) {
				for (const statement of program.body) {
					const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement
					if (declaration?.type !== "VariableDeclaration") continue
					if (declaration.kind !== "const") report(declaration, `A module-scope ${declaration.kind}`)
					for (const declarator of declaration.declarations) declaredNames(declarator.id, moduleNames)
				}
			},
			CallExpression(node) {
				const callee = node.callee
				if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return
				if (!mutators.has(callee.property.name)) return
				const root = rootIdentifier(callee.object)
				if (root !== undefined && moduleNames.has(root) && callee.object.type === "Identifier")
					report(node, `Calling ${root}.${callee.property.name}()`)
			},
			AssignmentExpression(node) {
				checkTarget(node, node.left)
			},
			UpdateExpression(node) {
				checkTarget(node, node.argument)
			},
			UnaryExpression(node) {
				if (node.operator === "delete") checkTarget(node, node.argument)
			},
		}
	},
}

export default rule
