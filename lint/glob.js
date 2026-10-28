/**
 * A glob as a regular expression. `*` matches inside one folder and `**` across folders, and each is a capture group.
 * `{a,b}` is an alternation and `[A-Z]` a character class. Neither captures.
 *
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
	let source = ""
	let depth = 0
	for (let index = 0; index < glob.length; index++) {
		const char = glob[index]
		if (char === "*" && glob[index + 1] === "*") {
			const isFolder = glob[index + 2] === "/"
			source += isFolder ? "(?:(.*)/)?" : "(.*)"
			index += isFolder ? 2 : 1
		} else if (char === "*") source += "([^/]*)"
		else if (char === "[" && glob.indexOf("]", index) > index) {
			const end = glob.indexOf("]", index)
			source += glob.slice(index, end + 1)
			index = end
		} else if (char === "{") {
			source += "(?:"
			depth++
		} else if (char === "}" && depth > 0) {
			source += ")"
			depth--
		} else if (char === "," && depth > 0) source += "|"
		else source += char.replace(/[.+?^$()|[\]\\]/g, "\\$&")
	}
	return new RegExp(`^${source}$`)
}

/**
 * A test for repo-relative paths that match one of the globs. A glob that starts with `!` leaves its paths out.
 *
 * @param {ReadonlyArray<string>} globs
 * @returns {(file: string) => boolean}
 */
export function globMatcher(globs) {
	const included = globs.filter((glob) => !glob.startsWith("!")).map(globToRegExp)
	const excluded = globs.filter((glob) => glob.startsWith("!")).map((glob) => globToRegExp(glob.slice(1)))
	return (file) => included.some((pattern) => pattern.test(file)) && !excluded.some((pattern) => pattern.test(file))
}

/**
 * The part of `file` that one of the folder globs matches, such as `packages/ordering/src` for a file inside it.
 *
 * @param {ReadonlyArray<string>} folders
 * @param {string} file
 * @returns {string | undefined}
 */
export function rootOf(folders, file) {
	for (const folder of folders) {
		const match = new RegExp(`${globToRegExp(folder).source.slice(0, -1)}/`).exec(file)
		if (match !== null) return match[0].slice(0, -1)
	}
	return undefined
}
