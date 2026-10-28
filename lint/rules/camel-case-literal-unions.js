const isKebab = (value) => !/^[a-z][a-zA-Z0-9]*$/.test(value) && /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(value)
const toCamel = (value) => value.replaceAll(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase())

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				'Spell the members of a string union in camelCase, as named statuses are (`"notReady"`), not kebab-case.',
		},
	},
	create(context) {
		return {
			TSUnionType(node) {
				const literals = node.types.filter(
					(member) =>
						member.type === "TSLiteralType" &&
						member.literal?.type === "Literal" &&
						typeof member.literal.value === "string"
				)
				if (literals.length < 2) return
				for (const member of literals) {
					const value = member.literal.value
					if (isKebab(value))
						context.report({
							node: member,
							message: `Write \`"${value}"\` in camelCase, such as \`"${toCamel(value)}"\`. See docs/NAMING.md#predicates-and-lookups.`,
						})
				}
			},
		}
	},
}

export default rule
