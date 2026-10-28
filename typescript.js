import { createRequire } from "node:module"
import path from "node:path"

/**
 * The project's own TypeScript, so a checker and the flags read from it come from one copy. Falls back to the copy this
 * package can see when the project has none.
 */
function load() {
	try {
		return createRequire(path.join(process.cwd(), "package.json"))("typescript")
	} catch {
		return createRequire(import.meta.url)("typescript")
	}
}

const ts = load()
export default ts
