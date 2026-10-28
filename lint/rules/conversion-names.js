import { isModuleLevel } from "../functionShape.js"

/** Leading words that are verbs, so `To` or `From` after them is a destination, as in `scrollToSection`. */
const verbs = new Set([
	"to",
	"from",
	"decode",
	"encode",
	"maybe",
	"make",
	"is",
	"has",
	"can",
	"scroll",
	"move",
	"jump",
	"go",
	"navigate",
	"sync",
	"with",
	"get",
	"set",
	"format",
	"fold",
	"reflect",
	"read",
	"write",
	"add",
	"remove",
	"toggle",
	"apply",
	"clamp",
	"copy",
	"restore",
	"bind",
	"use",
])

const isFunction = (node) => node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression"

const rule = {
	meta: {
		type: "problem",
		docs: { description: "Start a conversion with its verb: `toCsv(rows)`, not `rowsToCsv`." },
	},
	create(context) {
		function check(node, name) {
			const match = name?.match(/^([a-z][a-z0-9]*)[A-Za-z0-9]*?(To|From)([A-Z]\w*)$/)
			if (match == null || verbs.has(match[1])) return
			const suggestion = `${match[2] === "To" ? "to" : "from"}${match[3]}`
			context.report({
				node,
				message: `\`${name}\` puts its verb in the middle. Start with it, as \`${suggestion}\`. See docs/NAMING.md#conversions.`,
			})
		}
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
