# Writing

Every piece of prose in this repository follows this guide. That covers docs, READMEs, doc comments, changesets, commit messages, pull request descriptions, review comments, and everything an agent writes during a coding session.

Write for someone who has never seen this code. They should understand each sentence the first time they read it.

## Say what changed and why it matters

Start with the point. For every change, finding, or feature, give two things:

1. What happens, or what changed, in plain words.
2. Why a user, a caller, or the next maintainer should care.

A reader who stops after two sentences should still know both. Explain how it works only when the reader needs that to use it or review it.

Don't write:

> Refactored the date helpers to leverage namespace imports, enhancing consistency across the codebase.

Write:

> `dateRange.ts` now exports `format` instead of `formatDateRange`. Callers already read it as `DateRange.format`, so the old name said "date range" twice.

## Use plain words

- Write the way one person explains something to another. Use the word a developer would say out loud: "use", not "leverage". "Move", not "migrate over".
- Explain a term the first time you need it, or use the plain word. "A cache hit, where the value comes from memory instead of the network."
- Use the real name of a file, function, command, or flag in code font, not a description of it: `User.make`, `bun run check`.
- Call each thing by one name everywhere.
- Say who does what. "The router loads the page data", not "the page data is loaded".
- Give numbers and behavior, not feelings. "A renamed column fails the build", not "safer refactors".

Don't write:

> The namespace-import invariant is now enforced at the lint layer.

Write:

> `bun run lint` now fails when a file imports a function from `dateRange.ts` by name instead of through `import * as DateRange`.

## Name the mechanism

Write who acts, the action, and the object, using the names from the code. "The tool skips this" names none of the three.

Don't write:

> The build ignores the helper. The next run updates a copy you left alone.

Write:

> `build` compiles `dateRange.ts` to `dist/dateRange.js`. The next run overwrites `dist/dateRange.js` when you have not edited that file.

Use an ordinary programming word as it stands. Do not define `pure`, `hash`, or `import`. When this doc gives a word a meaning the reader does not already have, define it in that sentence.

Don't write:

> That folder is a context.

Write:

> A bounded context is one part of the business, and the words in that folder mean what they mean there. Order can mean a customer's purchase in one folder and a billing document in another.

Don't explain a rule by naming one familiar value. `the way Effect code imports Option` is one module. Say `the way Effect modules are imported`, then show the call.

Don't write:

> Callers import the file as a namespace, the way Effect code imports `Option`.

Write:

> Callers import a domain file as a namespace, the way Effect modules are imported.
>
> ```ts
> import * as OrderLine from "./domain/OrderLine"
> import * as Product from "./domain/Product"
>
> const line = OrderLine.make(Product.getBySku("TEA-01"), { quantity: 2 })
> ```

## Keep sentences short

- One idea per sentence. Split a sentence the reader has to read twice.
- Mix short and longer sentences, so the text doesn't read like a list of fragments.
- Cut every word that does no work, but keep the small words that show structure: "the", "a", "that".
- Write whole sentences. No arrows, no dropped verbs, no symbol shorthand.

## Make it easy to scan

- Headings state the point and use sentence case: "Pin the Effect version", not "Versioning".
- Use a table to compare cases, and a numbered list for steps.
- Keep paragraphs to a few sentences.
- Put the common case first and the exceptions after.
- Don't use headings, bullets, or tables to pad out a three-sentence answer.

## Show code where it helps

Code makes a claim concrete. Copy snippets from the real code, keep them short, and make sure they compile. Never invent an API or simplify a snippet until it stops being true.

Don't write:

> The cart members were renamed to drop the redundant prefix.

Write:

> The cart members no longer repeat the module name:
>
> ```ts
> // Before
> Cart.getCartTotal(cart, currency)
> // After
> Cart.getTotal(cart, currency)
> ```

| Writing                      | Code snippets                                                  |
| ---------------------------- | -------------------------------------------------------------- |
| Docs, READMEs, doc comments  | Yes, to show usage and behavior.                               |
| Pull request descriptions    | Yes. Show the problem and the fix for each main change.        |
| Review comments and findings | Yes. Show the code at fault and the fix.                       |
| Chat replies                 | Yes, when you explain a change or a finding.                   |
| Changesets                   | Inline code for names. A short block only for migration steps. |
| Commit messages              | No. Name files and symbols in plain sentences.                 |

For a format this table doesn't list, add a snippet only when the reader would otherwise have to open the code to follow the point.

## Cut what sounds machine-written

These patterns make text harder to read. Remove them as you write.

- No em dashes or en dashes as punctuation. End the sentence or use a comma.
- Use a colon only before a list, a table, or a code block, never mid-sentence.
- Drop inflated words: delve, crucial, robust, seamless, leverage, utilize, facilitate, pivotal, landscape, showcase, underscore, ensure.
- Say "is" or "has", not "serves as", "stands as", or "boasts".
- Cut filler. "In order to" is "to". "It is important to note that" is nothing.
- Don't stack hedges. "Could potentially possibly" is "may". State what you measured, inferred, or guessed.
- List the real number of things, not a forced group of three.
- Say what the code does instead of using a metaphor: no "north star", no "scaffolding".
- Don't put a bold label on every bullet. "**Speed:** speed improved" becomes a sentence.
- No chat phrases: "Great question", "I hope this helps", "Let me know if". Answer directly.

## Apply the writing skills

Apply these three skills from [pstack](https://github.com/michael-denyer/pstack-claude) to every text you write. They are installed in `~/.agents/skills/`. If they aren't there, try finding them in `plugins/pstack/skills/` in that repo, otherwise look them up online directly.

| Skill               | What it does                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `bro`               | Says it plainly, like one person talking to another, with no jargon.                                                                |
| `unslop`            | Cuts AI tells: filler, hedging, em dashes, "leverage", "ensure", "crucial", bold labels on every bullet, and closing chatbot lines. |
| `technical-writing` | Sets the structure: one kind of document per file, active voice, "you", commands for steps, and no sentence that reads two ways.    |

## Chat replies

- Answer the question in the first line.
- Then give what the reader needs to act: what changed, what passed or failed, choices you made, and what is left.
- Back every claim with what you ran or read. Say when something is a guess.
- Report results as they are. When a check fails, show the error.
- Don't recap the whole conversation, and don't end with "Let me know if…".

```text
`bun run check` fails at lint. One warning in parseDate.ts:14 asks for
`endsWith` instead of a regex. Everything else passes: 72 test files, 421 tests.
```

## Commit messages

- A subject line in the imperative, under 72 characters, that says what changed.
- A body that says what changed and why, in plain sentences wrapped at 72 characters.
- Name the real files and symbols.
- No code blocks, no logs, no lists of hashes.

```text
Read date helpers through their namespace

Date helpers exported loose functions that callers imported by name, so
a call like formatDateRange didn't show which module it came from. The
helpers now drop the prefix and callers import them as namespaces, as
in DateRange.format. The lint fails on a named import of these modules.
```

## Pull request descriptions

A reviewer should get the point in under a minute.

1. One or two sentences on what the pull request does, or a short table of problem and fix.
2. One section per main change, with the problem, the fix, and a snippet of each.
3. How you checked it, with the commands you ran and the tests you added.
4. What is left out, or what isn't verified.

Link to long logs instead of pasting them.

````markdown
Date helpers exported loose functions, so a call like `formatDateRange(…)`
didn't show which module owned it. They are now read through namespaces.

## Drop the module name from helper names

Each name repeated its module, and callers couldn't tell where it came from.

```ts
// Before
import { formatDateRange } from "./dateRange"
formatDateRange(range, locale)
// After
import * as DateRange from "./dateRange"
DateRange.format(range, locale)
```

## Checks

- `bun run check` passes.
- Added `dateRange.test.ts` for a range that crosses a year.
````

## Docs

Pick one purpose per page: teach a first use, solve one task, describe an API, or explain a design. Don't mix them.
