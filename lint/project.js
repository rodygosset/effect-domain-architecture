import { loadConfig } from "../config.js"
import { globMatcher } from "./glob.js"

/** The project's `architecture.config.ts`, read once when oxlint loads the plugin. Rule options win over it. */
export const project = await loadConfig()

const vendored = globMatcher(project.vendored ?? [])

/** Code the project doesn't own, such as generated files and registry components. No rule of this plugin reads it. */
export const isVendored = (file) => vendored(file)

/** The files other code imports a context, the shared kernel or a page through. */
export const entryGlobs = () => [
	...[...(project.contexts ?? []), ...(project.sharedKernel === undefined ? [] : [project.sharedKernel])].flatMap(
		(folder) => (project.entryFiles ?? ["index.ts"]).map((entry) => `${folder}/${entry}`)
	),
	...(project.frontend?.pages === undefined ? [] : [`${project.frontend.pages}/*/index.{ts,tsx}`]),
]

/** Folders whose PascalCase subfolders are slices. */
export const sliceRoots = () => (project.frontend?.root === undefined ? [] : [project.frontend.root])
