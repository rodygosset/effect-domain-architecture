#!/usr/bin/env node
// Renders docs/domain/*.md from domain-model.json.
// Usage: node render-docs.mjs <path/to/domain-model.json> [--check]
// Writes next to the model, in docs/domain. With --check, compares instead of writing.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const args = process.argv.slice(2)
const check = args.includes("--check")
const file = args.find((arg) => !arg.startsWith("--"))
if (!file) {
	console.error("Usage: node render-docs.mjs <path/to/domain-model.json> [--check]")
	process.exit(2)
}

let model
try {
	model = JSON.parse(readFileSync(file, "utf8"))
} catch (error) {
	console.error(`Cannot read ${file}: ${error.message}`)
	process.exit(2)
}

const out = join(dirname(resolve(file)), "docs", "domain")

// Helpers

const list = (key) => model[key] ?? []
const byId = new Map()
for (const key of [
	"glossary",
	"subdomains",
	"contexts",
	"relations",
	"valueObjects",
	"aggregates",
	"commands",
	"events",
	"policies",
	"queries",
	"errors",
	"externalSystems",
	"stories",
]) {
	for (const element of list(key)) byId.set(element.id, element)
}
const relationName = (relation) => `${nameOf(relation.from)} to ${nameOf(relation.to)}`
const nameOf = (id) => {
	const element = byId.get(id)
	if (element?.from && element?.to) return relationName(element)
	return element?.name ?? element?.term ?? element?.title ?? id
}
const names = (ids) => (ids ?? []).map(nameOf).join(", ")
const cell = (value) =>
	String(value ?? "")
		.replace(/\|/g, "\\|")
		.replace(/\n/g, " ")
const table = (headers, rows) =>
	rows.length === 0
		? ""
		: [
				`| ${headers.join(" | ")} |`,
				`|${headers.map(() => "---").join("|")}|`,
				...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
			].join("\n") + "\n"
const fields = (map) =>
	Object.entries(map ?? {})
		.map(([key, type]) => `\`${key}: ${type}\``)
		.join(", ") || "none"
/** A heading and its body, or nothing when the body is empty. */
const section = (heading, body) => (body ? `${heading}\n\n${body}` : undefined)
/** Rules are sentences, so they read as one paragraph. */
const sentences = (rules) =>
	(rules ?? [])
		.map((rule) => rule.trim())
		.filter((rule) => rule.length > 0)
		.map((rule) => rule[0].toUpperCase() + rule.slice(1) + (/[.!?]$/.test(rule) ? "" : "."))
		.join(" ")
const timingWords = { eventual: "in the background", "same-transaction": "in the same transaction" }
const triggerWords = (trigger) =>
	trigger.event
		? `after ${nameOf(trigger.event)}`
		: trigger.after
			? `after ${nameOf(trigger.after)}`
			: `on the schedule \`${trigger.schedule}\``
/** Event sourcing changes how code is added, so the recipes follow the aggregates' persistence. */
const storesEvents = list("aggregates").some((aggregate) => aggregate.persistence?.strategy === "events")
const contextRoot = model.repo?.layout?.contextRoot ?? "src/<context>"
const [rootBefore, rootAfter] = contextRoot.split("<context>")
const folder = (context) => {
	const module = context.module
	if (module.startsWith(rootBefore) && module.endsWith(rootAfter)) {
		return module.slice(rootBefore.length, module.length - rootAfter.length)
	}
	return module.split("/").filter(Boolean).pop()
}
const contextFile = (context) => `contexts/${folder(context)}.md`
const contextOf = (element) => element.context ?? byId.get(element.aggregate)?.context
const inContext = (key, id) => list(key).filter((element) => contextOf(element) === id)
const mermaidId = (id) => id.replace(/^ctx\./, "")
const frontend = model.repo?.frontend ?? { kind: "none" }
const transport = frontend.kind === "none" ? "none" : frontend.transport
const doc = (...parts) =>
	parts
		.filter((part) => part !== undefined)
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd() + "\n"

const files = new Map()

// README.md

files.set(
	"README.md",
	doc(
		"# Domain",
		"",
		model.purpose.summary,
		"",
		`Users: ${model.purpose.users.join(", ")}.`,
		"",
		`What they get: ${model.purpose.value}`,
		"",
		"## Contexts",
		"",
		table(
			["Context", "Rank", "Purpose", "Folder"],
			list("contexts").map((context) => [
				`[${context.name}](${contextFile(context)})`,
				byId.get(context.subdomain)?.kind,
				context.purpose,
				`\`${context.module}\``,
			])
		),
		model.sharedKernel === undefined
			? undefined
			: doc(
					"## Shared kernel",
					"",
					model.sharedKernel.purpose,
					"",
					`Code: \`${model.sharedKernel.module}\`. Used by ${names(model.sharedKernel.contexts)}.`,
					"",
					table(
						["Name", "Shape", "Rules"],
						inContext("valueObjects", "kernel").map((value) => [
							value.name,
							value.kind === "id" ? `id, \`${value.shape}\`` : fields(value.fields),
							sentences(value.rules),
						])
					)
				),
		"## Files",
		"",
		"- [glossary.md](glossary.md): the words to use. `domain-model.json` lists the words each one retires.",
		"- [context-map.md](context-map.md): the contexts and how they talk.",
		"- [stories.md](stories.md): what happens, step by step.",
		"- [decisions.md](decisions.md): why the model has this shape.",
		"- [architecture.md](architecture.md): where code goes, and how to add to it.",
		"- `contexts/`: one file per context, with its aggregates, rules, commands and queries.",
		"",
		"## Keeping these docs true",
		"",
		"These files describe the code as it is, and the domain-discovery skill's `scripts/render-docs.mjs` writes them from `domain-model.json`. When the code changes, change the model in the same commit and render again. An edit made here by hand is lost at the next render.",
		""
	)
)

// glossary.md

const termsByWord = new Map()
for (const term of list("glossary")) {
	const word = term.term.toLowerCase()
	termsByWord.set(word, [...(termsByWord.get(word) ?? []), term])
}
const sharedTerms = [...termsByWord].filter(([, terms]) => new Set(terms.map((term) => term.context)).size > 1)

files.set(
	"glossary.md",
	doc(
		"# Glossary",
		"",
		"Use these words in code, docs and conversation. The words each term retires are in its `retire` list in `domain-model.json`, and `effect-domain check-naming` fails on them. Change a term there first, then render these docs again.",
		"",
		...list("contexts").flatMap((context) => [
			`## ${context.name}`,
			"",
			table(
				["Word", "Meaning"],
				inContext("glossary", context.id).map((term) => [term.term, term.meaning])
			),
		]),
		sharedTerms.length === 0
			? undefined
			: doc(
					"## Words that change meaning between contexts",
					"",
					table(
						["Word", "Context", "Meaning"],
						sharedTerms.flatMap(([, terms]) =>
							terms.map((term) => [term.term, nameOf(term.context), term.meaning])
						)
					)
				)
	)
)

// context-map.md

files.set(
	"context-map.md",
	doc(
		"# Context map",
		"",
		"```mermaid",
		"flowchart LR",
		...list("contexts").map((context) => `  ${mermaidId(context.id)}[${context.name}]`),
		...list("relations").map(
			(relation) =>
				`  ${mermaidId(relation.from)} -->|${names(relation.carries) || relation.via}| ${mermaidId(relation.to)}`
		),
		"```",
		"",
		"## Relations",
		"",
		"`Translates` is yes when the From context turns what it reads into its own words before its domain sees it.",
		"",
		table(
			["From", "To", "How", "What crosses", "Translates"],
			list("relations").map((relation) => [
				nameOf(relation.from),
				nameOf(relation.to),
				relation.via,
				names(relation.carries),
				relation.translation === "acl" ? "yes" : "no",
			])
		)
	)
)

// contexts/<context>.md

/** The errors every command of an aggregate can raise, said once above its commands instead of on every row. */
const sharedErrors = (commands) =>
	commands.length < 2
		? []
		: commands[0].rejectsWith.filter((id) => commands.every((command) => command.rejectsWith.includes(id)))

const renderAggregate = (aggregate) => {
	const commands = list("commands").filter((command) => command.aggregate === aggregate.id)
	const shared = sharedErrors(commands)
	const emits = commands.some((command) => (command.emits ?? []).length > 0)
	const events = list("events").filter((event) => event.aggregate === aggregate.id)
	return doc(
		`### ${aggregate.name}`,
		"",
		aggregate.why,
		"",
		`Identity: \`${nameOf(aggregate.identity)}\`.`,
		"",
		aggregate.states.length === 1
			? `Fields: ${fields(aggregate.states[0].fields)}.\n`
			: section(
					"States:",
					table(
						["State", "Fields"],
						aggregate.states.map((state) => [state.name, fields(state.fields)])
					)
				),
		section(
			"Entities:",
			table(
				["Entity", "Fields"],
				aggregate.entities.map((entity) => [entity.name, fields(entity.fields)])
			)
		),
		section(
			"Rules:",
			table(
				["Rule", "Error"],
				aggregate.invariants.map((invariant) => [invariant.rule, nameOf(invariant.error)])
			)
		),
		section(
			"Commands:",
			(shared.length === 0 ? "" : `Each command can be refused with ${names(shared)}.\n\n`) +
				table(
					[
						"Command",
						"Who",
						"What it does",
						...(emits ? ["Emits"] : []),
						shared.length === 0 ? "Refused with" : "Also refused with",
					],
					commands.map((command) => [
						command.name,
						command.actor,
						command.intent,
						...(emits ? [names(command.emits)] : []),
						names(command.rejectsWith.filter((id) => !shared.includes(id))),
					])
				)
		),
		section(
			"Events:",
			table(
				["Event", "Fields"],
				events.map((event) => [event.name, fields(event.fields)])
			)
		)
	)
}

for (const context of list("contexts")) {
	const subdomain = byId.get(context.subdomain)
	const relations = list("relations").filter((relation) => relation.from === context.id || relation.to === context.id)
	files.set(
		contextFile(context),
		doc(
			`# ${context.name}`,
			"",
			context.purpose,
			"",
			`Part of ${subdomain?.name} (${subdomain?.kind}). Code: \`${context.module}\`.`,
			"",
			(model.sharedKernel?.contexts ?? []).includes(context.id)
				? `Uses the shared kernel in \`${model.sharedKernel.module}\`: ${names(inContext("valueObjects", "kernel").map((value) => value.id))}. See [the domain README](../README.md#shared-kernel).\n`
				: undefined,
			section(
				"## Aggregates",
				inContext("aggregates", context.id)
					.map((aggregate) => renderAggregate(aggregate))
					.join("\n")
			),
			section(
				"## Value objects",
				table(
					["Name", "Shape", "Rules"],
					inContext("valueObjects", context.id).map((value) => [
						value.name,
						value.kind === "id" ? `id, \`${value.shape}\`` : fields(value.fields),
						sentences(value.rules),
					])
				)
			),
			section(
				"## Reactions",
				table(
					["Name", "When", "Then", "Runs"],
					inContext("policies", context.id).map((policy) => [
						policy.name,
						triggerWords(policy.trigger),
						nameOf(policy.then),
						timingWords[policy.timing] ?? policy.timing,
					])
				)
			),
			section(
				"## Queries",
				table(
					["Query", "Input", "Output"],
					inContext("queries", context.id).map((query) => [
						query.name,
						fields(query.input),
						fields(query.output),
					])
				)
			),
			section(
				"## Errors",
				table(
					["Error", "Meaning"],
					inContext("errors", context.id).map((error) => [error.name, error.meaning])
				)
			),
			section(
				"## External systems",
				table(
					["System", "Purpose", "Operations"],
					inContext("externalSystems", context.id).map((system) => [
						system.name,
						system.purpose,
						system.operations.join(", "),
					])
				)
			),
			section(
				"## Talks to",
				table(
					["Direction", "Context", "What crosses"],
					relations.map((relation) =>
						relation.from === context.id
							? ["reads from or calls", nameOf(relation.to), names(relation.carries)]
							: ["is read or called by", nameOf(relation.from), names(relation.carries)]
					)
				)
			)
		)
	)
}

// stories.md

const storyGroups = [
	["main", "Main stories"],
	["unhappy", "When things go wrong"],
	["case", "Real cases checked against the model"],
]
files.set(
	"stories.md",
	doc(
		"# Stories",
		"",
		"What happens, in the words of the people who use the system.",
		"",
		...storyGroups.flatMap(([kind, heading]) => {
			const stories = list("stories").filter((story) => story.kind === kind)
			if (stories.length === 0) return []
			return [
				`## ${heading}`,
				"",
				...stories.flatMap((story) => [
					`### ${story.title}`,
					"",
					...story.steps.map((step, i) => `${i + 1}. ${step}`),
					"",
				]),
			]
		})
	)
)

// decisions.md

/** Delegated choices, one row per reason. A reason shared by many elements counts them instead of naming each. */
const delegated = new Map()
for (const element of byId.values()) {
	for (const entry of element.evidence ?? []) {
		if (typeof entry !== "string" || !entry.startsWith("decided:")) continue
		const reason = entry.slice("decided:".length).trim()
		const elements = delegated.get(reason) ?? new Set()
		elements.add(nameOf(element.id))
		delegated.set(reason, elements)
	}
}
const delegatedRows = [...delegated].map(([reason, elements]) => [
	reason,
	elements.size > 8 ? `${elements.size} elements` : [...elements].join(", "),
])
files.set(
	"decisions.md",
	doc(
		"# Decisions",
		"",
		"Why the model has this shape. Read this before changing a boundary or a name. Tests and docs cite a decision by its id. Each aggregate's boundary is explained on its context's page.",
		"",
		section(
			"## Settled with the people",
			table(
				["Id", "Decision", "What the code did before"],
				list("tensions").map((tension) => [`\`${tension.id}\``, tension.resolution, tension.code])
			)
		),
		section(
			"## Decided without an interview question",
			delegatedRows.length === 0
				? ""
				: "These choices were made while building, by the agent or by the owner on review, not in the discovery interview. `decided:` entries in the evidence of `domain-model.json` name each element.\n\n" +
						table(["Reason", "Elements"], delegatedRows)
		),
		section(
			"## Left out",
			list("outOfScope")
				.map((item) => `- ${item}`)
				.join("\n")
		)
	)
)

// architecture.md

const storageFolder = model.repo.storage === "@effect/sql-pg" ? "Postgres" : "<Storage>"
const stateLayout = [
	"index.ts                       server entry: the service modules, as namespaces",
	"contract/",
	"  index.ts                     ids, schemas, errors and endpoint groups, safe for the browser",
	transport === "http-api" ? "  <Context>Group.ts             the HttpApi group" : undefined,
	transport === "rpc" ? "  Rpc.ts                       the RPC group" : undefined,
	transport === "local" ? "browser.ts                     the layer that runs the context in the browser" : undefined,
	"domain/",
	"  <Concept>.ts                 one concept: its schema, id, pure rules and errors",
	"application/",
	"  <Concepts>.ts                the concept's service: its commands and queries",
	"  <Concept>Store.ts            the port the service reads and writes through",
	"infrastructure/",
	`  ${`${storageFolder}/<Concept>Store.ts`.padEnd(29)}the store's adapter`,
	"  <Context>Layer.ts            the layer that builds the context's services",
]
const eventLayout = [
	"index.ts                       server API: service classes and the context layer",
	"contract/",
	"  index.ts                     browser-safe schemas: ids, values, commands, queries, events, errors",
	transport === "local" ? "browser.ts                     the layer that runs the context in the browser" : undefined,
	"domain/                        value objects, aggregates with decide and evolve, errors",
	"application/                   command services, queries, event bus, reactions",
	"infrastructure/                event store layers, external system adapters, translations",
]
const exposeStep = {
	rpc: "Add an `Rpc.make` entry to the context's RPC group in `contract/` and its handler in `infrastructure/`.",
	"http-api": "Add an endpoint to the context's group in `contract/` and its handler in `infrastructure/`.",
	local: "The frontend calls the new method directly, through the layer in `browser.ts`.",
	other: "Add a handler to the entry point that serves it. It calls the new method and nothing else.",
	none: "Add a handler to the entry point that serves it. It calls the new method and nothing else.",
}[transport]
const stateRecipes = [
	"## Add a command",
	"",
	"1. Add the rule to the concept's module in `domain/`, as a pure function that returns the changed record or fails with the rule's error. Add a new error to the same module. Test each rule.",
	"2. Add a method to the concept's service in `application/`. It reads the record through the store, applies the domain function, and writes the result back.",
	"3. When the method needs a read or a write the store lacks, add it to the store's port and to each adapter.",
	`4. Export what crosses the wire from \`contract/index.ts\`. ${exposeStep}`,
	"",
	"## Run work after a command or on a schedule",
	"",
	"1. Work that must succeed or fail with the command goes in the command's method, in the same storage transaction.",
	"2. Work that may finish later is started by the command's method in a fiber that the service's layer owns, so stopping the app interrupts it.",
	"3. Work on a schedule starts in the context's layer, from a `Schedule` or a `Cron`.",
	"",
	"## Add a query",
	"",
	`1. Add a method to the concept's service in \`application/\`, and the read it needs to the store. ${exposeStep}`,
	"",
	"## Add an external system",
	"",
	"1. Add a port in `application/`, named for what it does.",
	"2. Add its adapter in `infrastructure/`, in a folder named for the technology, and a test layer.",
]
const eventRecipes = [
	"## Add a command",
	"",
	"1. Add the command class to `domain/<Aggregate>.ts` and to its command union.",
	"2. Add its decide function there. It checks the rules and returns events. Test each rule.",
	"3. Add any new event and its case in `evolve`. Add any new error to the same module.",
	"4. Add a method to the aggregate's command service in `application/`. It loads, decides, saves and publishes.",
	`5. Export the command from \`contract/index.ts\`. ${exposeStep}`,
	"",
	"## Add a reaction to an event",
	"",
	"1. Add the reaction to the context's reactions in `application/`. It runs after its event and calls one command method.",
	"2. If both changes must succeed or fail together, call the second command inside the first command's method, in one storage transaction, instead.",
	"",
	"## Add a query",
	"",
	`1. Add a method to the context's queries in \`application/\`. ${exposeStep}`,
]

files.set(
	"architecture.md",
	doc(
		"# Architecture",
		"",
		"Where code goes, and how to add to it. Built with Effect v4. The guides in `docs/architecture/` hold the naming and layering rules.",
		"",
		"## Layout",
		"",
		`One folder per context, at \`${contextRoot}\`. [README.md](README.md) lists them. Inside each context folder:`,
		"",
		"```",
		...(storesEvents ? eventLayout : stateLayout),
		"```",
		"",
		model.repo.storage && model.repo.storage !== "none"
			? `${storesEvents ? "Event stores" : "Stores"} keep data with \`${model.repo.storage}\`.\n`
			: undefined,
		"## Import rules",
		"",
		"- `domain/` imports only `effect` and other files in `domain/`.",
		"- `contract/` imports only `effect`, `effect/rpc`, `effect/http-api` and `domain/`.",
		"- Another context's server code imports this context only through `index.ts`.",
		"- Browser code imports a context only through `contract/`" +
			(transport === "local" ? " and `browser.ts`." : "."),
		frontend.kind === "none"
			? undefined
			: doc(
					"",
					"## Frontend",
					"",
					transport === "other"
						? `The frontend in \`${frontend.path}\` has its own client for the API. Screen state stays in the frontend.`
						: `The ${frontend.kind} frontend in \`${frontend.path}\` reaches the domain through \`${transport}\`. Its files are grouped by context. Screen state stays in the frontend.`
				),
		"",
		...(storesEvents ? eventRecipes : stateRecipes),
		"",
		"Then add the change to `domain-model.json`, with any new word in its glossary, and render these docs again.",
		""
	)
)

// Write or check

const problems = []
for (const [path, content] of files) {
	const target = join(out, path)
	if (check) {
		if (!existsSync(target)) problems.push(`missing: docs/domain/${path}`)
		else if (readFileSync(target, "utf8") !== content) problems.push(`out of date: docs/domain/${path}`)
	} else {
		mkdirSync(dirname(target), { recursive: true })
		writeFileSync(target, content)
	}
}

if (problems.length > 0) {
	console.log(problems.join("\n"))
	console.log(`\n${problems.length} problem(s). Fix the model, then render the docs again.`)
	process.exit(1)
}
console.log(check ? "OK" : `Wrote ${files.size} files to docs/domain.`)
