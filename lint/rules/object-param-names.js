import { functionName, propsFunctions } from "../functionShape.js"

/** A parameter named for its data, such as `point` or `page`, keeps its name. Only these generic bag names must agree. */
const genericNames = new Set(["props", "args", "options", "input", "config", "params", "opts", "settings"])

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Name an object parameter `options` when it has a default and `args` everywhere else. Functions whose names match the `propsFunctions` pattern take `props`.",
		},
		schema: [{ type: "object", properties: { propsFunctions: { type: "string" } }, additionalProperties: false }],
	},
	create(context) {
		const takesProps = propsFunctions(context)
		function check(node) {
			const hasProps = takesProps?.test(functionName(node) ?? "") === true
			for (const param of node.params) {
				const target = param.type === "AssignmentPattern" ? param.left : param
				if (target.type !== "Identifier" || !genericNames.has(target.name)) continue
				if (target.typeAnnotation?.typeAnnotation?.type !== "TSTypeLiteral") continue
				const expected = hasProps ? "props" : param.type === "AssignmentPattern" ? "options" : "args"
				if (target.name !== expected)
					context.report({
						node: target,
						message: `Name this object parameter \`${expected}\`: \`options\` for an optional settings object with a default, \`args\` for every other function${takesProps ? ", and `props` for functions named like `" + takesProps.source + "`" : ""}. See docs/NAMING.md.`,
					})
			}
		}
		return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check }
	},
}

export default rule
