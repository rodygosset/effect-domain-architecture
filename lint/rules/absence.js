import { relativeFile } from "../files.js"
import { propsFunctions } from "../functionShape.js"
import { globMatcher } from "../glob.js"

const schemaHelpers = new Set(["optional", "optionalKey", "NullOr", "NullishOr", "UndefinedOr"])

const transparentTypes = new Set(["TSParenthesizedType", "TSTypeOperator"])

const ownedMessage =
	"Absence in an internal API is `Option`. Write `name: Option.Option<T>` and convert foreign values with `Option.fromUndefinedOr` at the boundary. Only foreign shapes in `infrastructure/`, and props the lint config exempts, keep `?:`."

/** Folders whose types mirror a foreign shape, such as an index document or an HTTP body, so they keep `?:`. */
const defaultForeignShapes = ["**/infrastructure/**"]

/** Test fixtures are builders, not APIs, so their optional patches stay `?:`. */
function isTestFile(filename) {
	return /\.test\.tsx?$/.test(filename)
}

function typeChildren(node) {
	if (!node || typeof node !== "object") return []
	const children = []
	for (const key of Object.keys(node)) {
		if (key === "parent" || key === "range" || key === "loc" || key === "type") continue
		const value = node[key]
		if (Array.isArray(value)) {
			for (const item of value) if (item && typeof item.type === "string") children.push(item)
		} else if (value && typeof value.type === "string") children.push(value)
	}
	return children
}

function walkOwnedTypes(type, visit) {
	if (!type || typeof type.type !== "string") return
	if (type.type === "TSTypeParameterInstantiation") return
	visit(type)
	if (type.type === "TSTypeReference") return
	for (const child of typeChildren(type)) walkOwnedTypes(child, visit)
}

function unwrap(type) {
	let current = type
	while (current && transparentTypes.has(current.type)) current = current.typeAnnotation
	return current
}

function hasUndefined(type) {
	const current = unwrap(type)
	return current?.type === "TSUnionType" && current.types.some((part) => unwrap(part)?.type === "TSUndefinedKeyword")
}

function paramBinding(param) {
	if (param.type === "Identifier" || param.type === "ObjectPattern" || param.type === "ArrayPattern") return param
	if (param.type === "AssignmentPattern") return paramBinding(param.left)
	if (param.type === "TSParameterProperty") return paramBinding(param.parameter)
	return undefined
}

function functionName(node) {
	if (node.id?.type === "Identifier") return node.id.name
	const parent = node.parent
	if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name
	return undefined
}

/** The `props` parameter of a function whose name matches the `propsFunctions` pattern, which keeps `?:`. */
function isExemptProps(takesProps, fn, binding) {
	const name = functionName(fn)
	return (
		takesProps !== undefined &&
		binding.type === "Identifier" &&
		binding.name === "props" &&
		name !== undefined &&
		takesProps.test(name)
	)
}

function reportNullTypes(type, context) {
	walkOwnedTypes(type, function (node) {
		if (node.type !== "TSNullKeyword") return
		context.report({
			node,
			message:
				"Absence is never `null`. Use `Option` in an internal API, and convert a foreign `null` with `Option.fromNullishOr` at the boundary.",
		})
	})
}

function isFunctionNode(node) {
	return (
		node.type === "FunctionDeclaration" ||
		node.type === "FunctionExpression" ||
		node.type === "ArrowFunctionExpression"
	)
}

/** A generic constraint describes the keys a caller may pass, so its optional keys are types, not absent values. */
function inTypeParameter(node) {
	for (let current = node.parent; current; current = current.parent)
		if (current.type === "TSTypeParameter") return true
	return false
}

/** `declare module` augments a library's own types, so its shape is the library's. */
function inModuleAugmentation(node) {
	for (let current = node.parent; current; current = current.parent)
		if (current.type === "TSModuleDeclaration") return true
	return false
}

/** The function whose parameter list holds this type, if any. */
function owningParam(node) {
	let child = node
	for (let current = node.parent; current; current = current.parent) {
		if (isFunctionNode(current)) {
			const param = current.params?.find((candidate) => candidate === child)
			return param ? { fn: current, binding: paramBinding(param) } : undefined
		}
		if (current.type === "TSTypeParameterInstantiation" || current.type === "TSFunctionType") return undefined
		child = current
	}
	return undefined
}

/** `key?: never` forbids a key in one member of a union. It describes no absent value. */
function isForbiddenKey(member) {
	return member.optional && unwrap(member.typeAnnotation?.typeAnnotation)?.type === "TSNeverKeyword"
}

function reportSignature(member, context) {
	if (member.type !== "TSPropertySignature" || isForbiddenKey(member)) return
	if (member.optional || hasUndefined(member.typeAnnotation?.typeAnnotation))
		context.report({ node: member, message: ownedMessage })
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Absence in an internal API is Option, and Schema absence uses Option codecs. Only foreign shapes, and the props of functions the `propsFunctions` pattern names, keep `?:`.",
		},
		schema: [
			{
				type: "object",
				properties: {
					propsFunctions: { type: "string" },
					foreignShapes: { type: "array", items: { type: "string" } },
				},
				additionalProperties: false,
			},
		],
	},
	create(context) {
		if (context.filename.endsWith(".d.ts")) return {}
		const foreignShapes = globMatcher(context.options[0]?.foreignShapes ?? defaultForeignShapes)(
			relativeFile(context)
		)
		const isTest = isTestFile(context.filename)
		const takesProps = propsFunctions(context)
		return {
			CallExpression(node) {
				const callee = node.callee
				if (
					callee.type !== "MemberExpression" ||
					callee.computed ||
					callee.object.type !== "Identifier" ||
					callee.object.name !== "Schema" ||
					callee.property.type !== "Identifier" ||
					!schemaHelpers.has(callee.property.name)
				)
					return
				context.report({
					node: callee,
					message: `Use Schema.OptionFromOptional or Schema.OptionFromOptionalNullOr instead of Schema.${callee.property.name}. Decoded absence uses Option.`,
				})
			},
			TSPropertySignature(node) {
				if (isTest || inTypeParameter(node) || inModuleAugmentation(node)) return
				const param = owningParam(node)
				if (param ? param.binding && isExemptProps(takesProps, param.fn, param.binding) : foreignShapes) return
				reportSignature(node, context)
			},
			"FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(node) {
				const returnType = node.returnType?.typeAnnotation
				if (!isTest && hasUndefined(returnType)) context.report({ node: returnType, message: ownedMessage })
				for (const param of node.params ?? []) {
					const binding = paramBinding(param)
					const type = binding?.typeAnnotation?.typeAnnotation
					if (!type) continue
					reportNullTypes(type, context)
					if (isTest || isExemptProps(takesProps, node, binding)) continue
					if (binding.optional || hasUndefined(type)) context.report({ node: binding, message: ownedMessage })
				}
			},
		}
	},
}

export default rule
