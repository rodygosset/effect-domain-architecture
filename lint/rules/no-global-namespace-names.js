const globals = new Set([
	"Array",
	"BigInt",
	"Boolean",
	"Date",
	"Error",
	"Function",
	"Intl",
	"JSON",
	"Map",
	"Math",
	"Number",
	"Object",
	"Promise",
	"Proxy",
	"Record",
	"Reflect",
	"RegExp",
	"Set",
	"String",
	"Symbol",
	"URL",
	"WeakMap",
	"WeakSet",
])

/** Effect's own modules shadow globals on purpose (Array, Record, String). */
const isEffectModule = (source) => source === "effect" || source.startsWith("effect/") || source.startsWith("@effect/")

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"A local module imported as a namespace must not take the name of a JavaScript global, such as Map or Date.",
		},
	},
	create(context) {
		return {
			ImportDeclaration(node) {
				if (isEffectModule(String(node.source.value))) return
				for (const specifier of node.specifiers)
					if (specifier.type === "ImportNamespaceSpecifier" && globals.has(specifier.local.name))
						context.report({
							node: specifier,
							message: `\`import * as ${specifier.local.name}\` hides the global \`${specifier.local.name}\` in this file. Rename the module or its folder so its namespace says what it is, such as \`OrderMap\`. See docs/NAMING.md.`,
						})
			},
		}
	},
}

export default rule
