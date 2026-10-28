import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

/** The file each project keeps at its root. It reads the contexts and the glossary from `domain-model.json`. */
export const configFile = "architecture.config.ts"

/**
 * The config with each key a project may leave out filled in. A backend-only project leaves out `frontend`, and a
 * project with one source folder needs only `sourceRoots`.
 */
export const withDefaults = (config) => ({
	contexts: [],
	entryFiles: ["index.ts"],
	packageRoots: [],
	sourceRoots: ["src"],
	sharedLibraries: [],
	generated: [],
	vendored: [],
	cliFolders: [],
	runtimeModules: ["node:*", "bun:*"],
	predicatePrefixes: ["is", "has", "can", "should"],
	keepFunctions: ["^[A-Z]"],
	glossary: [],
	...config,
	frontend: { namespaceModules: [], ...config.frontend },
	naming: {
		exempt: ["**/*.d.ts"],
		frameworkFiles: [],
		outsideWords: [],
		wireNames: [],
		orphanTests: [],
		...config.naming,
	},
	docs: { pathRoots: ["src", "docs", "scripts"], shortRoots: {}, ...config.docs },
	effect: { packages: {}, ...config.effect },
	program: { extensions: [], ...config.program },
})

/**
 * The default export of `architecture.config.ts` in `root` with its defaults filled in. An empty config when the
 * project has none. Node and Bun both strip the types, so the file may use TypeScript syntax that erases.
 *
 * @param {string} root
 */
export async function loadConfig(root = process.cwd()) {
	const file = path.join(root, configFile)
	if (!fs.existsSync(file)) return withDefaults({})
	return withDefaults((await import(pathToFileURL(file).href)).default)
}
