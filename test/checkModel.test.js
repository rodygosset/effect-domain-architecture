import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const checker = path.resolve(import.meta.dirname, "../skills/domain-discovery/scripts/check-model.mjs")
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "effect-domain-check-model-"))

const confirmed = { status: "confirmed", evidence: ["user: the owner said so"] }

/** The smallest model the checker accepts: one context with one aggregate, its id, command, event and error. */
const model = {
	version: 1,
	repo: {
		mode: "greenfield",
		checks: ["bun run check"],
		layout: { contextRoot: "src/<context>" },
		storage: "none",
		frontend: { kind: "none" },
	},
	purpose: { summary: "Take orders.", users: ["customer"], value: "Orders arrive.", ...confirmed },
	glossary: [
		{ id: "term.order", term: "Order", meaning: "A request.", context: "ctx.ordering", retire: [], ...confirmed },
	],
	subdomains: [{ id: "sub.ordering", name: "Ordering", kind: "core", why: "It is the business.", ...confirmed }],
	contexts: [
		{
			id: "ctx.ordering",
			name: "Ordering",
			subdomain: "sub.ordering",
			purpose: "Orders.",
			module: "src/ordering",
			...confirmed,
		},
	],
	relations: [],
	valueObjects: [
		{
			id: "vo.orderId",
			context: "ctx.ordering",
			name: "Id",
			kind: "id",
			shape: "integer",
			rules: [],
			replaces: [],
			...confirmed,
		},
	],
	aggregates: [
		{
			id: "agg.order",
			context: "ctx.ordering",
			name: "Order",
			identity: "vo.orderId",
			why: "It guards its lines.",
			states: ["Open"],
			entities: [],
			invariants: [{ id: "inv.orderOnce", rule: "An order is placed once.", error: "err.alreadyPlaced" }],
			persistence: "none",
			...confirmed,
		},
	],
	commands: [
		{
			id: "cmd.place",
			aggregate: "agg.order",
			name: "place",
			intent: "Place an order.",
			actor: "customer",
			input: {},
			emits: ["evt.placed"],
			rejectsWith: ["err.alreadyPlaced"],
			replaces: [],
			...confirmed,
		},
	],
	events: [{ id: "evt.placed", aggregate: "agg.order", name: "Placed", fields: {}, ...confirmed }],
	policies: [],
	queries: [],
	errors: [
		{
			id: "err.alreadyPlaced",
			context: "ctx.ordering",
			name: "AlreadyPlaced",
			fields: {},
			meaning: "Placed twice.",
			...confirmed,
		},
	],
	externalSystems: [],
	tensions: [],
	stories: [
		{
			id: "sto.place",
			title: "Place",
			kind: "main",
			steps: ["Place an order."],
			refs: ["cmd.place"],
			...confirmed,
		},
		{
			id: "sto.twice",
			title: "Twice",
			kind: "case",
			steps: ["Place it again."],
			refs: ["err.alreadyPlaced"],
			...confirmed,
		},
	],
	outOfScope: [],
	openQuestions: [],
}

/** One plan step that creates `files` and refs every element, then the final step that updates the model. */
const withPlan = (files) => ({
	...model,
	plan: {
		steps: [
			{
				id: "step.order",
				title: "Build the order",
				refs: ["vo.orderId", "agg.order", "cmd.place", "evt.placed", "err.alreadyPlaced"],
				create: files.map((file) => ({ path: file, construct: "module" })),
				verify: ["bun run check"],
			},
			{
				id: "step.model",
				title: "Update the model",
				dependsOn: ["step.order"],
				edit: [{ path: "domain-model.json", change: "Match the code." }],
				verify: ["bun run check"],
			},
		],
	},
})

function check(plannedModel) {
	const file = path.join(folder, "domain-model.json")
	fs.writeFileSync(file, JSON.stringify(plannedModel))
	const result = spawnSync("node", [checker, file], { encoding: "utf8" })
	return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

try {
	const clean = check(withPlan(["src/ordering/domain/Order.ts"]))
	assert.equal(clean.status, 0, `A plan with one file per concept passes\n${clean.output}`)

	const narrowError = check(withPlan(["src/ordering/domain/Order.ts", "src/ordering/domain/AlreadyPlaced.ts"]))
	assert.equal(narrowError.status, 1, "A plan that gives an error its own file fails")
	assert.ok(
		narrowError.output.includes("src/ordering/domain/AlreadyPlaced.ts would hold only the error AlreadyPlaced"),
		narrowError.output
	)

	const narrowId = check(withPlan(["src/ordering/domain/Order.ts", "src/ordering/domain/Id.ts"]))
	assert.equal(narrowId.status, 1, "A plan that gives an id its own file fails")
	assert.ok(narrowId.output.includes("would hold only the id Id"), narrowId.output)
	assert.ok(narrowId.output.includes("(narrow-module)"), narrowId.output)
} finally {
	fs.rmSync(folder, { recursive: true, force: true })
}
process.stdout.write("check-model passed: one file per concept, and no file for an id or an error alone.\n")
