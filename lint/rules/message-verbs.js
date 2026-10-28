const codeVerb = /^(Created|Built|Computed|Calculated|Resolved|Equaled|Ensured|Upserted|Reconciled)(?=[A-Z]|$)/

const isTaggedUnionMake = (callee) =>
	callee.type === "MemberExpression" &&
	callee.object.type === "Identifier" &&
	callee.object.name === "TaggedUnion" &&
	callee.property.type === "Identifier" &&
	callee.property.name === "make"

const rule = {
	meta: {
		type: "problem",
		docs: { description: "Name a TaggedUnion case for what happened, without the verbs docs/NAMING.md replaces." },
	},
	create(context) {
		return {
			CallExpression(node) {
				if (!isTaggedUnionMake(node.callee)) return
				const [cases] = node.arguments
				if (cases?.type !== "ObjectExpression") return
				for (const property of cases.properties) {
					if (property.type !== "Property" || property.key.type !== "Identifier") continue
					const verb = property.key.name.match(codeVerb)?.[1]
					if (verb !== undefined)
						context.report({
							node: property.key,
							message: `\`${property.key.name}\` starts with \`${verb}\`, a code verb NAMING.md replaces. Say what the person or the system did, such as \`SavedCriterion\`. See docs/NAMING.md#conversions.`,
						})
				}
			},
		}
	},
}

export default rule
