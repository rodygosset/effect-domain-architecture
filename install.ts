/**
 * Copies the framework's docs and skills into the project in the working folder, and records a hash of each copy in
 * `architecture.lock.json`. On a later run it updates every copy the project left alone, and reports each copy the
 * project changed instead of overwriting it.
 *
 * - `--check` writes nothing and fails when a copy is missing, out of date, or changed by hand.
 * - `--force` overwrites copies changed by hand.
 */
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

/** Each framework folder, and where its files go in the project. */
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
		const source = fs.readFileSync(path.join(packageRoot, target.from, file))
		const relative = path.posix.join(target.to, file.replaceAll("\\", "/"))
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
