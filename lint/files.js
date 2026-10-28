/** The file's path from the directory that holds `.oxlintrc.json`, with forward slashes. */
export function relativeFile(context) {
	const cwd = context.cwd.replaceAll("\\", "/")
	const file = context.filename.replaceAll("\\", "/")
	return file.startsWith(`${cwd}/`) ? file.slice(cwd.length + 1) : file
}
