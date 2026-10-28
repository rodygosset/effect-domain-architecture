/** Tags owned by Effect data types, which ship their own predicates. */
const effectTags = new Map([
	["Some", "Option.isSome"],
	["None", "Option.isNone"],
	["Initial", "AsyncResult.isInitial"],
	["Success", "AsyncResult.isSuccess, Exit.isSuccess, or Result.isSuccess"],
	["Failure", "AsyncResult.isFailure, Exit.isFailure, or Result.isFailure"],
])

function unwrap(node) {
	return node?.type === "ChainExpression" ? node.expression : node
}

/** A stable text key for `a`, `a.b`, or `this.a.b`. Undefined for anything computed. */
function subjectKey(node) {
	const expression = unwrap(node)
	if (expression?.type === "Identifier") return expression.name
	if (expression?.type === "ThisExpression") return "this"
	if (expression?.type === "MemberExpression" && !expression.computed && expression.property.type === "Identifier") {
		const object = subjectKey(expression.object)
		return object === undefined ? undefined : `${object}.${expression.property.name}`
	}
	return undefined
}

function tagAccessSubject(node) {
	const expression = unwrap(node)
	if (expression?.type !== "MemberExpression" || expression.computed) return undefined
	if (expression.property.type !== "Identifier" || expression.property.name !== "_tag") return undefined
	return subjectKey(expression.object)
}

function isStringLiteral(node) {
	return node?.type === "Literal" && typeof node.value === "string"
}

/** `subject._tag === "tag"` (either side, `===` or `!==`). */
function tagComparison(node) {
	if (node?.type !== "BinaryExpression" || (node.operator !== "===" && node.operator !== "!==")) return undefined
	const [access, literal] = isStringLiteral(node.right) ? [node.left, node.right] : [node.right, node.left]
	if (!isStringLiteral(literal)) return undefined
	const subject = tagAccessSubject(access)
	return subject === undefined ? undefined : { subject, tag: literal.value, operator: node.operator }
}

/** Comparisons joined by one logical operator, or undefined when any operand is something else. */
function comparisonChain(node, operator) {
	if (node?.type === "LogicalExpression" && node.operator === operator) {
		const left = comparisonChain(node.left, operator)
		const right = comparisonChain(node.right, operator)
		return left === undefined || right === undefined ? undefined : [...left, ...right]
	}
	const comparison = tagComparison(node)
	return comparison === undefined ? undefined : [comparison]
}

function sameSubject(comparisons) {
	return comparisons.every((comparison) => comparison.subject === comparisons[0].subject)
}

/** The subject and tags an `if` test or ternary test branches on. */
function branchTags(test) {
	const chain = comparisonChain(test, "||") ?? comparisonChain(test, "&&")
	if (chain === undefined || !sameSubject(chain)) return undefined
	return { subject: chain[0].subject, tags: chain.map((comparison) => comparison.tag) }
}

const rule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Branch over several tags of one union with its own helpers: `Union.isAnyOf([...])`, `Union.match`, or `Match.tagsExhaustive`. Use the Effect module predicate for Option, Exit, Result, and AsyncResult tags.",
		},
	},
	create(context) {
		function reportBranches(node, subject) {
			context.report({
				node,
				message: `Several branches test ${subject}._tag. Use the union's match (or Match.tagsExhaustive) so the compiler checks every case.`,
			})
		}

		function checkStatements(statements) {
			const seen = new Map()
			for (const statement of statements) {
				let current = statement
				while (current?.type === "IfStatement") {
					const branch = branchTags(current.test)
					if (branch !== undefined) {
						const tags = seen.get(branch.subject) ?? new Set()
						const isNew = branch.tags.some((tag) => !tags.has(tag))
						if (tags.size > 0 && isNew) reportBranches(current, branch.subject)
						for (const tag of branch.tags) tags.add(tag)
						seen.set(branch.subject, tags)
					}
					current = current.alternate
				}
			}
		}

		return {
			BinaryExpression(node) {
				const comparison = tagComparison(node)
				if (comparison === undefined || !effectTags.has(comparison.tag)) return
				context.report({
					node,
					message: `Do not compare _tag with "${comparison.tag}". Use ${effectTags.get(comparison.tag)}.`,
				})
			},
			LogicalExpression(node) {
				if (node.parent?.type === "LogicalExpression" && node.parent.operator === node.operator) return
				const comparisons = comparisonChain(node, node.operator === "||" ? "||" : "&&")
				if (comparisons === undefined || comparisons.length < 2 || !sameSubject(comparisons)) return
				const expected = node.operator === "||" ? "===" : "!=="
				if (!comparisons.every((comparison) => comparison.operator === expected)) return
				const tags = comparisons.map((comparison) => `"${comparison.tag}"`).join(", ")
				context.report({
					node,
					message: `Use Union.isAnyOf([${tags}])(${comparisons[0].subject}) instead of chaining _tag comparisons.`,
				})
			},
			ConditionalExpression(node) {
				if (node.parent?.type === "ConditionalExpression") return
				const outer = branchTags(node.test)
				if (outer === undefined) return
				const nested = [node.consequent, node.alternate].some(function (branch) {
					if (branch.type !== "ConditionalExpression") return false
					return branchTags(branch.test)?.subject === outer.subject
				})
				if (nested) reportBranches(node, outer.subject)
			},
			BlockStatement(node) {
				checkStatements(node.body)
			},
			Program(node) {
				checkStatements(node.body)
			},
		}
	},
}

export default rule
