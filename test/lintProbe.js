import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const oxlint = path.resolve(import.meta.dirname, "../../node_modules/oxlint/bin/oxlint")

/** The topmost folder of `file`'s parents that doesn't exist yet, or the file itself when they all do. */
function firstMissing(file) {
	let missing = file
	let directory = path.dirname(file)
	while (!fs.existsSync(directory)) {
		missing = directory
		directory = path.dirname(directory)
	}
	return missing
}

/**
 * Writes `files` under `root`, lints them with the `.oxlintrc.json` in `root`, and removes them again. Each diagnostic
 * names its rule as configured, such as `effect-domain/absence` or `eslint/id-length`.
 */
export function lintProbe(root, files) {
	const created = []
	try {
		for (const [file, content] of Object.entries(files)) {
			const target = path.join(root, file)
			created.push(firstMissing(target))
			fs.mkdirSync(path.dirname(target), { recursive: true })
			fs.writeFileSync(target, content)
		}
		const result = spawnSync(
			"node",
			[oxlint, "--disable-nested-config", "--format", "json", ...Object.keys(files)],
			{ cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
		)
		if (result.error) throw result.error
		const report = JSON.parse(result.stdout)
		const crash = report.diagnostics.find((diagnostic) => diagnostic.message.startsWith("Error running JS plugin"))
		if (crash) throw new Error(crash.message)
		return report.diagnostics.map((diagnostic) => ({
			file: diagnostic.filename,
			rule: diagnostic.code?.replace(/^([^(]+)\((.+)\)$/, "$1/$2") ?? "",
			line: diagnostic.labels?.[0]?.span?.line ?? 0,
			message: diagnostic.message,
		}))
	} finally {
		for (const target of created.reverse()) fs.rmSync(target, { recursive: true, force: true })
	}
}
