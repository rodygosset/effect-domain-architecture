---
name: review
description: Reviews a branch in a project that installed effect-domain-architecture, one pass per area, from code quality to prose, then applies the fixes worth making and reruns the checks. Use when asked to review a branch, a pull request or a merge request, or before you open one.
---

# Review

A review finds the mistakes the checks can't, and fixes them. Each pass below looks for one kind of mistake, so you read the whole diff once per pass.

1. Read the diff with `git diff <base>...HEAD`, where `<base>` is the branch the work merges into. Read the pull request description and the commit messages too.
2. Run the passes in order, and write down each finding as you go.
3. Apply the fixes worth making. Skip a finding only when the fix costs more than the mistake, and say why.
4. Rerun the checks the project's `AGENTS.md` and `package.json` list, such as its tests, lint, `effect-domain check-program` and `effect-domain check-naming`. Report each failure as it is.

## Write each finding with the code and the fix

Each finding names the file and line, says what goes wrong, and shows the code at fault and the fix. Follow `docs/WRITING.md` for review comments.

````markdown
`domain/Order.ts:42` lists the statuses as plain strings, so a misspelled status compiles and never matches. `Status.pick` only accepts members of `Status`, and `canCancel` narrows the type for the caller.

```ts
// Before
const canCancel = (status: Status) => ["Placed", "Paid"].includes(status)
// After
const canCancel = Schema.is(Status.pick(["Placed", "Paid"]))
```
````

## Code quality

Check the diff against `docs/GUIDELINES.md` for function shape and comments. Look for dead code, repeated code, an `as` cast, a non-null `!`, and a lint suppression with no reason after `--`.

## Effect API use

Look for hand-written code that an Effect API already does. Before you suggest an API, find it in the Effect source the project pins, as `docs/EFFECT.md` says.

| Hand-written                                      | Use                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| An `includes` check over a list of literals       | `Schema.is(Status.pick(["Placed", "Paid"]))`                                  |
| `try`/`finally` around a resource                 | `Effect.acquireUseRelease`, or `Effect.acquireRelease` in a scope             |
| `vi.fn`, `vi.mock`, `vi.spyOn` or `vi.stubGlobal` | A test layer, as `docs/TESTING.md#control-dependencies-with-test-layers` says |

A file read with `try`/`finally`, and the same read with `Effect.acquireUseRelease`:

```ts
// Before
async function readInvoice(path: string) {
	const file = await fs.open(path)
	try {
		return await file.readFile("utf8")
	} finally {
		await file.close()
	}
}
// After
const readInvoice = (path: string) =>
	Effect.acquireUseRelease(
		Effect.tryPromise(() => fs.open(path)),
		(file) => Effect.tryPromise(() => file.readFile("utf8")),
		(file) => Effect.promise(() => file.close())
	)
```

## Module boundaries

`effect-domain check-program` already fails on an import past a context's entry files and on impure code in `domain/`. Review catches code in the wrong folder, such as a pure rule inside a service, or a database query in `application/`. Check each new file against the table in `docs/CONTEXTS.md#where-code-goes`.

## Domain words

Read every new name, string union member and comment against the glossary in `domain-model.json`. A word the glossary retires fails `effect-domain check-naming`, but a synonym the glossary never listed passes it. Replace each synonym with the glossary word, and add a missing term to the glossary with the domain-discovery skill instead of inventing one.

## Tests

Ask the five questions in `docs/TESTING.md#name-the-mistake-each-test-catches` of every added or changed test, and delete a test that has no answer to the first. Delete a test of anything on the list in `docs/TESTING.md#skip-what-something-else-already-checks`.

## Naming

Check each new name against `docs/NAMING.md`. Lint catches the verbs and the case. Review catches the rest: a bare noun as a boolean, a predicate about what someone may do that isn't named for its command, and a file name that doesn't say what the file holds.

## Prose

Run the writing skill's checklist on every changed text, then check it against `docs/WRITING.md`. That covers Markdown files, doc comments, test comments, commit messages and the pull request description.
