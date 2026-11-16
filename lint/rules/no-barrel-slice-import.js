import { existsSync, statSync } from "node:fs"
import { dirname, relative, resolve, sep } from "node:path"
import { project } from "../project.js"

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

/** Whether `file` lies in `folder` or one of its subfolders. */
const isInside = (folder, file) => {
	const path = relative(folder, file)
	return path !== "" && !path.startsWith("..") && !path.startsWith(sep)
}

/**
 * A folder of a FoldKit app, whose index is the folder's namespace, as in FoldKit's project organization. Code imports
 * it like a slice entry, so long as the folder doesn't hold the importing file, which would make an import cycle.
 */
function isAppBarrel(cwd, filename, targetDirectory) {
	if (project.frontend?.app === undefined) return false
	const app = resolve(cwd, project.frontend.app)
	return isInside(app, targetDirectory) && !isInside(targetDirectory, filename)
}

/** A relative specifier reaches a barrel when it names an `index` file or a directory holding one. */
function reachesBarrel(cwd, filename, source) {
	if (!isRelative(source)) return false
	const target = resolve(dirname(filename), source)
	const targetDirectory = isIndexFile(source) ? dirname(target) : target
	if (targetDirectory === dirname(filename)) return false
	if (isAppBarrel(cwd, filename, targetDirectory)) return false
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
			if (!reachesBarrel(context.cwd, context.filename, source)) return
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
