import { existsSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"

const indexExtensions = ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"]

function isRelative(source) {
	return source === "." || source === ".." || source.startsWith("./") || source.startsWith("../")
}

function isIndexFile(source) {
	return new RegExp(`(^|/)index(\\.(${indexExtensions.join("|")}))?$`).test(source)
}

function isDirectoryWithIndex(path) {
	if (!existsSync(path) || !statSync(path).isDirectory()) return false
	return indexExtensions.some((extension) => existsSync(resolve(path, `index.${extension}`)))
}

/** A relative specifier reaches a barrel when it names an `index` file or a directory holding one. */
function reachesBarrel(filename, source) {
	if (!isRelative(source)) return false
	const target = resolve(dirname(filename), source)
	const targetDirectory = isIndexFile(source) ? dirname(target) : target
	if (targetDirectory === dirname(filename)) return false
	// A machine folder's index is its public namespace, so importing it is no barrel import.
	if (["model.ts", "message.ts", "update.ts"].every((file) => existsSync(resolve(targetDirectory, file))))
		return false
	return isIndexFile(source) || isDirectoryWithIndex(target)
}

const rule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Disallow value imports from relative index files or directories that cross directories. Import cross-slice symbols from the owning slice public entry and intra-slice symbols from their defining module.",
		},
	},
	create(context) {
		function check(node, source, typeOnly) {
			if (typeOnly || typeof source !== "string") return
			if (!reachesBarrel(context.filename, source)) return
			context.report({
				node,
				message: `Do not import from barrel "${source}". Import from the defining module instead.`,
			})
		}

		return {
			ImportDeclaration(node) {
				check(node.source, node.source.value, node.importKind === "type")
			},
			ExportNamedDeclaration(node) {
				if (node.source !== null) check(node.source, node.source.value, node.exportKind === "type")
			},
			ExportAllDeclaration(node) {
				check(node.source, node.source.value, node.exportKind === "type")
			},
			ImportExpression(node) {
				if (node.source.type === "Literal") check(node.source, node.source.value, false)
				else if (node.source.type === "TemplateLiteral" && node.source.expressions.length === 0)
					check(node.source, node.source.quasis[0]?.value.cooked, false)
			},
		}
	},
}

export default rule
