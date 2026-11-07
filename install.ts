/**
 * Copies the framework's guides and skills into the project in the working folder, and records a hash of each copy in
 * `architecture.lock.json`. On a later run it updates every copy the project left alone, and reports each copy the
 * project changed instead of overwriting it.
 *
 * - `--check` writes nothing and fails when a copy is missing, out of date, or changed by hand.
 * - `--force` overwrites copies changed by hand.
 */
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

/** Each framework folder, and where its files go in the project. `guideDestination` places each guide. */
const targets = [
	{ from: "docs", to: "docs/architecture" },
	{ from: "skills", to: ".agents/skills" },
]
const lockFile = "architecture.lock.json"

interface Lock {
	readonly version: string
	readonly files: Record<string, string>
}

const packageRoot = import.meta.dirname
const root = process.cwd()
const isCheck = process.argv.includes("--check")
const isForce = process.argv.includes("--force")
const hash = (content: Buffer) => createHash("sha256").update(content).digest("hex")

/**
 * Guides about every text in a project, not only its code, go straight into `docs/`. The others go into
 * `docs/architecture/`.
 */
const projectWideGuides = new Set(["WRITING.md"])
const guides = fs.readdirSync(path.join(packageRoot, "docs")).filter((file) => file.endsWith(".md"))
const guideDestination = (guide: string) =>
	projectWideGuides.has(guide) ? `docs/${guide}` : `docs/architecture/${guide}`
const guideNames = guides.map((file) => file.replaceAll(".", "\\.")).join("|")
/** A guide named from the repo root, as the skills write `docs/WRITING.md`. */
const guidePath = new RegExp(`\\bdocs/(${guideNames})`, "g")
/** A Markdown link from one guide to another, as `[WRITING.md](WRITING.md#rules)`. */
const guideLink = new RegExp(`\\]\\((${guideNames})(#[^)]*)?\\)`, "g")

/**
 * The copy of a framework file that `relative` names in the project. In this repo the guides sit together in `docs/`,
 * so a Markdown copy names each guide, and links to it, where the project has it.
 */
function toProjectCopy(relative: string, content: Buffer) {
	if (!relative.endsWith(".md")) return content
	const folder = path.posix.dirname(relative)
	const text = content
		.toString("utf8")
		.replace(guidePath, (_, guide: string) => guideDestination(guide))
		.replace(
			guideLink,
			(_, guide: string, heading = "") => `](${path.posix.relative(folder, guideDestination(guide))}${heading})`
		)
	return Buffer.from(text, "utf8")
}

/** Where a framework file goes in the project. */
const toProjectPath = (target: (typeof targets)[number], file: string) =>
	target.from === "docs" && guides.includes(file)
		? guideDestination(file)
		: path.posix.join(target.to, file.replaceAll("\\", "/"))

function filesIn(folder: string): Array<string> {
	return fs
		.readdirSync(folder, { recursive: true, encoding: "utf8" })
		.filter((file) => fs.statSync(path.join(folder, file)).isFile())
}

function readLock(): Lock {
	const file = path.join(root, lockFile)
	// oxlint-disable-next-line eslint/no-restricted-properties -- The lock is our own file, written below.
	return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { version: "", files: {} }
}

// oxlint-disable-next-line eslint/no-restricted-properties -- package.json of this package.
const version: string = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")).version
const lock = readLock()
const next: Record<string, string> = {}
const problems: Array<string> = []
let written = 0

for (const target of targets)
	for (const file of filesIn(path.join(packageRoot, target.from))) {
		const relative = toProjectPath(target, file)
		const source = toProjectCopy(relative, fs.readFileSync(path.join(packageRoot, target.from, file)))
		const destination = path.join(root, relative)
		const wanted = hash(source)
		next[relative] = wanted
		const present = fs.existsSync(destination) ? hash(fs.readFileSync(destination)) : undefined
		if (present === wanted) continue
		const isEditedByHand = present !== undefined && present !== lock.files[relative]
		if (isEditedByHand && !isForce) {
			problems.push(
				`${relative}: changed by hand since the last install. Move the change upstream, or run with --force.`
			)
			next[relative] = lock.files[relative] ?? wanted
			continue
		}
		if (isCheck) {
			problems.push(
				`${relative}: ${present === undefined ? "missing" : "out of date"}. Run effect-domain install.`
			)
			continue
		}
		fs.mkdirSync(path.dirname(destination), { recursive: true })
		fs.writeFileSync(destination, source)
		written++
	}

for (const relative of Object.keys(lock.files))
	if (next[relative] === undefined) problems.push(`${relative}: the framework no longer ships it. Delete it.`)

if (!isCheck)
	// oxlint-disable-next-line eslint/no-restricted-properties -- The lock is our own file.
	fs.writeFileSync(path.join(root, lockFile), `${JSON.stringify({ version, files: next }, undefined, "\t")}\n`)
for (const problem of problems) process.stderr.write(`${problem}\n`)
if (problems.length > 0) process.exitCode = 1
else
	process.stdout.write(
		isCheck ? `Docs and skills match effect-domain-architecture ${version}.\n` : `Installed ${written} files.\n`
	)
