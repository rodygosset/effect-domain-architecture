#!/usr/bin/env node
import path from "node:path"
import { pathToFileURL } from "node:url"
import { loadConfig } from "../config.js"
import { auditProgram } from "./audit.js"

const root = process.cwd()
const config = await loadConfig(root)
/** Each module in `program.extensions` default-exports a function that receives the program and returns its hooks. */
const extensions = await Promise.all(
	(config.program?.extensions ?? []).map(
		async (file) => (await import(pathToFileURL(path.join(root, file)).href)).default
	)
)
const findings = auditProgram(root, config, extensions)
for (const finding of findings)
	process.stderr.write(`${finding.file}:${finding.line}: ${finding.rule}: ${finding.message}\n`)
if (findings.length) process.exitCode = 1
else
	process.stdout.write(
		"check-program: slice imports, purity, namespaces, type-aware names and Option absence passed.\n"
	)
