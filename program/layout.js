import fs from "node:fs"
import path from "node:path"
import { globMatcher } from "../lint/glob.js"

/** The config with each key a project may leave out filled in. */
const withDefaults = (config) => ({
	contexts: [],
	entryFiles: ["index.ts"],
	sourceRoots: ["src"],
	sharedLibraries: [],
	vendored: [],
	runtimeModules: ["node:*", "bun:*"],
	predicatePrefixes: ["is", "has", "can", "should"],
	...config,
	frontend: { namespaceModules: [], ...config.frontend },
})

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * The facts of `architecture.config.ts` that check-program reads, as tests on file paths. A path may be absolute or
 * relative to `root`. Every key is optional, so a backend-only project leaves out `frontend`.
 */
export function compileLayout(root, options) {
	const config = withDefaults(options)
	const relative = (file) => (path.isAbsolute(file) ? path.relative(root, file) : file).replaceAll("\\", "/")
	const on = (test) => (file) => test(relative(file))
	const never = /(?!)/
	const frontend = config.frontend.root === undefined ? undefined : escape(config.frontend.root)
	const feature = frontend === undefined ? never : new RegExp(`^${frontend}/[A-Z][^/]*/`)
	const rootMachine = frontend === undefined ? never : new RegExp(`^${frontend}/[A-Z][^/]*(?:/[A-Z][^/]*)?$`)
	const featureFolders = frontend === undefined ? never : new RegExp(`^${frontend}/((?:[A-Z][^/]*/)+)`)
	const page = config.frontend.pages === undefined ? never : new RegExp(`^${escape(config.frontend.pages)}/[^/]+/`)
	const entries = new Set(
		config.contexts.flatMap((context) => config.entryFiles.map((entry) => `${context}/${entry}`))
	)
	const isRuntimeModule = (specifier) =>
		config.runtimeModules.some((module) =>
			module.endsWith("*")
				? specifier.startsWith(module.slice(0, -1))
				: specifier === module || specifier.startsWith(`${module}/`)
		)
	return {
		relative,
		isSource: on(globMatcher(config.sourceRoots.map((folder) => `${folder}/**`))),
		isVendored: on(globMatcher(config.vendored)),
		/** Browser workflow code: one PascalCase folder per slice under the frontend root. */
		isFeature: on((file) => feature.test(file)),
		/** A root machine sits directly in a slice folder, or one level down. */
		isRootMachineFolder: on((folder) => rootMachine.test(folder)),
		/** A context entry that other code imports the context through. It only re-exports namespaces. */
		isPackageEntry: on((file) => entries.has(file)),
		isSharedLibrary: on((file) => config.sharedLibraries.some((folder) => file.startsWith(`${folder}/`))),
		isFrontendNamespaceModule: on(globMatcher(config.frontend.namespaceModules)),
		isRuntimeModule,
		predicateName: new RegExp(`^(${config.predicatePrefixes.join("|")})[A-Z0-9]`),
		/**
		 * The slice that owns a file: a context with an entry, a page, or the shallowest PascalCase folder under the
		 * frontend root that has an index.ts. A file at a context root without an index belongs to no slice.
		 */
		sliceOf: on((file) => {
			const context = config.contexts.find((folder) => file.startsWith(`${folder}/`))
			if (context !== undefined)
				return config.entryFiles.some((entry) => fs.existsSync(path.join(root, context, entry)))
					? context
					: undefined
			const pageFolder = page.exec(file)
			if (pageFolder) return pageFolder[0].slice(0, -1)
			const folders = featureFolders
				.exec(file)?.[1]
				.split("/")
				.filter((folder) => folder !== "")
			if (folders === undefined) return undefined
			for (let depth = 1; depth <= folders.length; depth++) {
				const directory = `${config.frontend.root}/${folders.slice(0, depth).join("/")}`
				if (fs.existsSync(path.join(root, directory, "index.ts"))) return directory
			}
			return undefined
		}),
		/** A slice's entry files. */
		isEntryOf: (slice, file) => config.entryFiles.some((entry) => relative(file) === `${slice}/${entry}`),
	}
}
