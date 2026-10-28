/** `FOO_BAR`: an uppercase letter, then only uppercase letters, digits, and underscores. */
const isShouting = (name) => /^[A-Z][A-Z0-9_]+$/.test(name)

function bannedMessage(name) {
	if (name === "Live" || name.endsWith("Layer"))
		return `Do not name this \`${name}\`. Layers start with \`layer\` (\`layer\`, \`layerDemo\`); services take the group name, never \`Live\`. See docs/NAMING.md.`
	if (name.endsWith("Repository"))
		return "Do not suffix services `Repository`. Use the group name (`Orders`) and expose a `*Client` only for Atom HTTP wrappers. See docs/NAMING.md."
	if (name.endsWith("Schema") && name !== "Schema")
		return `Do not name this \`${name}\`. One name covers schema and type (\`Foo\` + \`typeof Foo.Type\`), never \`FooSchema\`. See docs/NAMING.md and docs/patterns/SCHEMA.md.`
	if (isShouting(name))
		return `Do not shout this binding (\`${name}\`). \`const\` already marks a constant; use camelCase (\`cellPageSize\`). See docs/NAMING.md.`
	return undefined
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Enforce docs/NAMING.md name bans: no Live layers, no *Repository services, no FooSchema, no SHOUTING constants.",
		},
	},
	create(context) {
		function check(node, name) {
			const message = name ? bannedMessage(name) : undefined
			if (message !== undefined) context.report({ node, message })
		}
		return {
			FunctionDeclaration: (node) => check(node.id ?? node, node.id?.name),
			VariableDeclarator(node) {
				if (node.id.type === "Identifier") check(node.id, node.id.name)
			},
			ClassDeclaration: (node) => check(node.id ?? node, node.id?.name),
			PropertyDefinition(node) {
				if (!node.computed && node.key.type === "Identifier") check(node.key, node.key.name)
			},
		}
	},
}

export default rule
