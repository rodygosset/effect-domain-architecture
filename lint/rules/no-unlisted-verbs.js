import { isModuleLevel } from "../functionShape.js"

const replacements = {
	create: "`make` for a new value",
	build: "`make` for a new value, or `to` for a projection",
	compute: "`to` for a projection, or the noun for a number (`pageCount`)",
	calculate: "`to` for a projection, or the noun for a number (`pageCount`)",
	resolve: "`to` for a projection, or `maybe` when it can find nothing",
	equal: "`isSame…`, or `X.equals = Schema.toEquivalence(X)` on a class",
	ensure: "`sync` when it makes MapLibre, TerraDraw, or another outside object match the state",
	upsert: "`with…` for a copy with one part set (`withoutArea`), or `sync` for an outside object",
	reconcile: "`sync` when it makes MapLibre, TerraDraw, or another outside object match the state",
}
const unlistedVerb = new RegExp(`^(${Object.keys(replacements).join("|")})(?=[A-Z0-9]|$)`)

const isFunction = (node) =>
	node?.type === "FunctionExpression" ||
	node?.type === "ArrowFunctionExpression" ||
	(node?.type === "CallExpression" && node.callee.type === "MemberExpression")

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Name functions with the docs/NAMING.md verbs. create, build, compute, calculate, resolve, equal, ensure, upsert, and reconcile each have a listed replacement.",
		},
	},
	create(context) {
		function check(node, name) {
			const verb = name?.match(unlistedVerb)?.[1]
			if (verb === undefined) return
			context.report({
				node,
				message: `Do not start \`${name}\` with \`${verb}\`. Use ${replacements[verb]}. See docs/NAMING.md#conversions.`,
			})
		}
		// Only module-level names. Functions inside a service's make mirror the API they wrap, such as createIndex.
		return {
			FunctionDeclaration(node) {
				if (isModuleLevel(node)) check(node.id ?? node, node.id?.name)
			},
			VariableDeclaration(node) {
				if (!isModuleLevel(node)) return
				for (const declarator of node.declarations)
					if (declarator.id.type === "Identifier" && isFunction(declarator.init))
						check(declarator.id, declarator.id.name)
			},
		}
	},
}

export default rule
