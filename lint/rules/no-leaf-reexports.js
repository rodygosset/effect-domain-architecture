import { relativeFile } from "../files.js"
import { globMatcher } from "../glob.js"
import { entryGlobs, sliceRoots } from "../project.js"

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** A slice-root module made only of re-exports is a second public entry, such as a lazily loaded `map-view.ts`. */
const isReexportOnly = (program) =>
	program.body.length > 0 &&
	program.body.every(
		(statement) =>
			statement.type === "ExportAllDeclaration" ||
			(statement.type === "ExportNamedDeclaration" && statement.source != null)
	)

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Re-exports belong only in a slice's or a package's public entry file. The entries and slice roots default to `architecture.config.ts`.",
		},
		schema: [
			{
				type: "object",
				properties: {
					entries: { type: "array", items: { type: "string" } },
					sliceRoots: { type: "array", items: { type: "string" } },
				},
				additionalProperties: false,
			},
		],
	},
	create(context) {
		const options = context.options[0] ?? {}
		const filename = relativeFile(context)
		// Under a slice root, each PascalCase folder is a slice. Its index.ts is its entry.
		const slices = (options.sliceRoots ?? sliceRoots()).map((folder) => ({
			entry: new RegExp(`^${escape(folder)}/[A-Z][^/]*/(?:[A-Z][^/]*/)*index\\.ts$`),
			module: new RegExp(`^${escape(folder)}/[A-Z][^/]*/(?:[A-Z][^/]*/)*[^/]+\\.ts$`),
		}))
		const isPublicEntry =
			globMatcher(options.entries ?? entryGlobs())(filename) ||
			slices.some((slice) => slice.entry.test(filename)) ||
			(slices.some((slice) => slice.module.test(filename)) && isReexportOnly(context.sourceCode.ast))
		function report(node) {
			if (!isPublicEntry) context.report({ node, message: "Re-export only from a slice's public entry file." })
		}
		return {
			ExportAllDeclaration(node) {
				if (!isPublicEntry) return report(node)
				// `export * as Orders from …` names one module namespace; a bare `export *` names nothing.
				if (node.exported === null)
					context.report({
						node,
						message:
							"List public symbols explicitly, or export one module as a namespace (export * as Name); do not use a bare export * in a slice entry.",
					})
			},
			ExportNamedDeclaration(node) {
				if (node.source !== null) report(node)
			},
		}
	},
}

export default rule
