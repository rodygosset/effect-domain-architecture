---
name: writing
description: Writes and edits prose the way docs/WRITING.md says, with plain words and short active sentences, and checks it before saving. Use before writing or editing a doc, a README, a code comment, a test comment, a commit message, a pull request description or a chat reply in a project that installed effect-domain-architecture.
---

# Writing

Read `docs/WRITING.md` before you write. It is the guide, and this skill says when to use it and what to check.

1. Write the draft.
2. Check it against each rule in `docs/WRITING.md`, one rule at a time.
3. Run the checklist below on every sentence, comment and snippet.
4. Rewrite every part that fails. Don't explain the rewrite.

For code comments, also follow the comment rules in `docs/GUIDELINES.md#comments`.

## Check before you save

Ask each question of the text. Fix every "no" before you save.

1. Read only the first two sentences. Can a reader who has never seen the code say what problem this solves?
2. Does every name in every snippet exist in the project, or come from the neutral examples in the guides? Look each one up. A function, option or command that sounds right but doesn't exist fails.
3. Does every sentence describe things as they are, with no "now", "no longer", "before", "used to" or "was"? A pull request description and a commit message may say what changed.
4. Does each comment state the rule the code follows, not the steps it takes or the change that made it?
5. Is every domain name a word from the glossary in `domain-model.json`? A predicate about what someone may do is named for its command, as `docs/NAMING.md#predicates-and-lookups` says.

## Before and after

### A doc comment states the rule

Don't write:

```ts
/** Handles status. */
export const canCancel = Schema.is(Status.pick(["Placed", "Paid"]))
```

Write:

```ts
/** A customer can cancel an order until it ships. After that, the customer returns it instead. */
export const canCancel = Schema.is(Status.pick(["Placed", "Paid"]))
```

### A pull request section leads with the problem

Don't write:

```markdown
## Order status

`Order.ts` adds a `canCancel` predicate built with `Schema.is` over two of the `Status` literals. `Order.cancel` calls
it before it writes, and the order page reads it to hide the button.
```

Write:

````markdown
## Refuse cancelling a shipped order

A customer could cancel an order after it shipped, and the warehouse sent it anyway. `Order.cancel` now refuses a
shipped order with `Order.AlreadyShippedError`, and the order page hides the Cancel button.

```ts
export const canCancel = Schema.is(Status.pick(["Placed", "Paid"]))
```
````

### A test comment states the rule it guards

Don't write:

```ts
// These tests pin the old order of invoice lines, from before the sort moved to the server.
```

Write:

```ts
// An invoice prints its lines in the order the customer added them, not by price.
```
