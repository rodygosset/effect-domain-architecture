import { project } from "../project.js"

/** Short words and the word to write instead. `naming.spelledOut` in `architecture.config.ts` adds to them. */
const defaults = {
	agg: "aggregation",
	aggs: "aggregations",
	coord: "coordinate",
	coords: "coordinates",
	str: "string",
	cfg: "config",
	idx: "index",
	msg: "message",
	btn: "button",
	evt: "event",
	elem: "element",
}
const replacements = { ...defaults, ...project.naming?.spelledOut }

const words = (name) =>
	name
		.replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replaceAll(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.split(/[\s_]+/)
		.filter((word) => word !== "")
		.map((word) => word.toLowerCase())

const capitalize = (word) => word.replace(/^./, (first) => first.toUpperCase())

const rule = {
	meta: {
		type: "problem",
		docs: { description: "Spell out every word of a name: `currentIndex`, `errorMessage`, `maxRings`." },
	},
	create(context) {
		function check(node) {
			if (node?.type !== "Identifier") return
			const name = node.name
			// snake_case and SCREAMING_CASE names belong to a wire format or the environment.
			if (name.includes("_")) return
			const parts = words(name)
			const word = parts.length > 1 ? parts.find((part) => Object.hasOwn(replacements, part)) : undefined
			if (word !== undefined)
				context.report({
					node,
					message: `\`${name}\` abbreviates \`${word}\`. Write \`${replacements[word]}\`. Wire keys keep their spelling. See docs/NAMING.md#abbreviations.`,
				})
			const limit = name.match(/^([a-z][A-Za-z0-9]*?)(Min|Max)([A-Z]\w*)$/)
			if (limit !== null) {
				const first = limit[2].toLowerCase()
				context.report({
					node,
					message: `\`${name}\` puts \`${first}\` in the middle. Start with it: \`${first}${capitalize(limit[1])}${limit[3]}\`. See docs/NAMING.md#constants.`,
				})
			}
		}
		const checkParams = (node) => node.params.forEach(check)
		return {
			VariableDeclarator: (node) => check(node.id),
			FunctionDeclaration(node) {
				check(node.id)
				checkParams(node)
			},
			FunctionExpression: checkParams,
			ArrowFunctionExpression: checkParams,
			ClassDeclaration: (node) => check(node.id),
			TSTypeAliasDeclaration: (node) => check(node.id),
			TSInterfaceDeclaration: (node) => check(node.id),
		}
	},
}

export default rule
