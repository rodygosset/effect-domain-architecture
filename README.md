# effect-domain-architecture

Docs, agent skills, and lint rules for a TypeScript app on Effect 4 that is structured as domain-driven design. The app can be a server, a browser app, or both.

Domain-driven design here means the folders follow the parts of the business. Each part has one folder. Each concept has one file. The file holds the concept's type, its schema, and its pure operations.

The guides installed under `docs/architecture/` tell an agent which folder a new file belongs in. The lint rules and `effect-domain check-program` fail when a file holds two concepts, or when code outside a folder imports past that folder's public entries.

## One file holds one concept

Callers import a domain file as a namespace, the way Effect modules are imported.

```ts
import * as OrderLine from "./domain/OrderLine"
import * as Product from "./domain/Product"

const line = OrderLine.make(Product.getBySku("TEA-01"), { quantity: 2 })
```

The schema and the type take the module's name, `OrderLine.OrderLine`.

A value that only this concept uses stays in the same file, such as `Order.Id` or `Order.Status`. Give it a new file when it has its own operations, such as `Money.add`. Also give it a new file when two concepts both use it, such as `Address` for a customer and a shipment.

A service file exports one `Service` class. Callers import that file as a namespace and take the service from it.

```ts
import * as Orders from "./Orders"

const program = Effect.gen(function* () {
	const orders = yield* Orders.Service
	return yield* orders.getById(id)
}).pipe(Effect.provide(Orders.layer))
```

## One folder is one bounded context

A bounded context is one part of the business, and the words in that folder mean what they mean there. Order can mean a customer's purchase in one folder and a billing document in another.

`architecture.config.ts` lists these folders. In a repo with several packages, one package can be one bounded context.

Code outside a bounded context imports it only through its public entries. An entry re-exports each module as a namespace.

```ts
export * as Order from "./domain/Order"
```

| Folder            | What it holds                                                                     |
| ----------------- | --------------------------------------------------------------------------------- |
| `domain/`         | One concept per file, with its type, schema, and pure operations.                 |
| `application/`    | Services that load and save those concepts.                                       |
| `infrastructure/` | Database, search, and HTTP clients.                                               |
| `contract/`       | Ids, schemas, errors, and HTTP API groups that other code and the browser import. |

Browser workflows live in their own folders. One workflow imports another only through that folder's `index.ts`. Frontend state management is left to the UI framework, though a library that integrates natively with Effect is recommended, such as FoldKit, a UI framework, or Effect Atom, a state management library.

`effect-domain install` copies this repo's `docs/` into the app at `docs/architecture/`. The agent reads `docs/architecture/CONTEXTS.md` and `docs/architecture/NAMING.md` there. In this repo, before that copy, those guides are [docs/CONTEXTS.md](docs/CONTEXTS.md) and [docs/NAMING.md](docs/NAMING.md).

## What the app needs

The app already depends on TypeScript 5.9 or newer, Effect 4.0.1 or newer, and Oxlint 1.86.0 or newer. Pin every Effect package to one exact release.

`effect-domain` runs on Node 22.18 or newer. `npx`, `pnpm exec`, and `bunx` all start that same Node program.

```bash
npx effect-domain check-program
pnpm exec effect-domain check-program
bunx effect-domain check-program
```

The package is not on npm yet. Add it from GitHub.

```bash
npm install -D github:rodygosset/effect-domain-architecture
pnpm add -D github:rodygosset/effect-domain-architecture
bun add -d github:rodygosset/effect-domain-architecture
```

## Add it to a project

1. From the project root, add the package and copy the guides and skills in.

```bash
npm install -D github:rodygosset/effect-domain-architecture
npx effect-domain install
```

`pnpm add -D` and `bun add -d` add the same GitHub dependency. `pnpm exec effect-domain install` and `bunx effect-domain install` run the same install.

`install` copies every file in this package's `docs/` to `docs/architecture/`, and every file in `skills/` to `.agents/skills/`. It writes `architecture.lock.json`, a hash of each of those copied files. The next `install` overwrites a copied guide or skill that you have not edited. If you edited one of those copies, `install` prints its path, leaves your edit in place, and exits with an error. `--force` overwrites those edits. `--check` reports a copied guide or skill that is missing or out of date, and it writes no files.

2. Ask the coding agent in your editor to run the `domain-discovery` skill. The install put it at `.agents/skills/domain-discovery/`.

In a new app, ask it to model the domain for a new app. There is no application code to read, so it starts from your description.

In an existing app, ask it to model the domain of this codebase. It reads the code, then interviews you. The plan moves files into the folders above and keeps the current behavior.

The agent asks one question at a time. It asks what happens, what can be refused, and which words the business uses. When you approve the summary, it has written two files.

`domain-model.json` sits at the repo root. It records the bounded contexts you agreed, the business vocabulary from the interview, and the plan of file changes.

`docs/domain/` describes the app in those words, for the next agent that edits the code.

3. Paste the prompt below to the agent so it applies the plan that domain discovery wrote, then adds `architecture.config.ts` and the Oxlint presets.

```text
Apply the plan in domain-model.json before you change config. Keep the behavior that plan says to keep.

Then add architecture.config.ts at the repo root. It default-exports one object and reads domain-model.json. Write this file, and drop any entry the app does not have.

import model from "./domain-model.json" with { type: "json" }

export default {
	contexts: model.contexts.map((context) => context.module),
	entryFiles: ["index.ts", "contract/index.ts", "browser.ts"],
	sourceRoots: ["packages/*/src"],
	packageRoots: ["packages/*/src"],
	glossary: model.glossary.map((entry) => ({ term: entry.term, retire: entry.retire })),
}

contexts is the folder of each bounded context from the interview. Read it from context.module in domain-model.json.

glossary is the business vocabulary from that interview. term is a word to keep. retire lists the older words to stop using for that thing.

entryFiles lists the public files of a bounded context. index.ts is the server entry. contract/index.ts holds the ids, schemas, and errors. Include browser.ts only when browser code imports the context.

sourceRoots lists the folders of the app's TypeScript. Use "src" when the app has one source folder. When the app has several packages, use that repo's pattern, often "packages/*/src".

packageRoots lists those packages so check-unreachable can scan them. Leave packageRoots out when the app is a single package.

Leave out any key the app does not need. Omitted keys take the defaults in the effect-domain-architecture package's config.js.

Then add these three presets to the extends array of .oxlintrc.json. Create that file if the app has none.

"./node_modules/effect-domain-architecture/lint/presets/core.json"
"./node_modules/effect-domain-architecture/lint/presets/contexts.json"
"./node_modules/effect-domain-architecture/lint/presets/style.json"

If the app uses FoldKit, also add "./node_modules/effect-domain-architecture/lint/overrides/foldkit.json", so FoldKit and this package do not both report the same line.

Do not copy paths from architecture.config.ts into .oxlintrc.json. The lint plugin reads architecture.config.ts itself.

Run npx effect-domain check-program and fix what it reports.
```

4. Run a check with Node, through `npx`, `pnpm exec`, or `bunx`.

```bash
npx effect-domain check-program
pnpm exec effect-domain check-program
bunx effect-domain check-program
```

Swap the last word for another check. Run `effect-domain` with no command to print the full list.

- `check-program` fails when a domain module is impure, or when code outside a bounded context imports past its entries.
- `check-naming` checks names against the business vocabulary from the interview.
- `check-circular` finds import cycles.
- `check-unreachable` finds files nothing imports.

## Add a typed check of your own

Skip this when the presets and `check-program` already cover the app.

Oxlint runs the rules named in `.oxlintrc.json`. `check-program` is a separate command. It can run an extra check that needs TypeScript types. You write that check as its own file, then tell `check-program` where the file is. Listing the file in `.oxlintrc.json` does not run it, and listing it in `program.extensions` does not make it an Oxlint rule.

Write the check anywhere in the app, for example `scripts/ordering-rules.ts`. Add that path to `program.extensions` in `architecture.config.ts`.

```ts
program: {
	extensions: ["./scripts/ordering-rules.ts"],
},
```

The file default-exports one function. `check-program` calls that function with an object of this shape.

```ts
{
	root: string
	config: object
	layout: object
	program: ts.Program
	checker: ts.TypeChecker
	parsed: ts.ParsedCommandLine
	sources: ReadonlyArray<ts.SourceFile>
	sourceByPath: Map<string, ts.SourceFile>
	report: (source: ts.SourceFile, node: ts.Node, rule: string, message: string) => void
}
```

- `root` is the project directory.
- `config` is the default export of `architecture.config.ts`, with the defaults from `config.js` filled in.
- `layout` holds the path tests built from that config, such as whether a file sits in a bounded context.
- `program` is the TypeScript program.
- `checker` is `program.getTypeChecker()`.
- `parsed` is the parsed `tsconfig.json`.
- `sources` lists the app's TypeScript files, skipping `.d.ts` files and `node_modules`.
- `sourceByPath` maps an absolute path to its source file.
- `report(source, node, rule, message)` records one finding, which `check-program` prints as `file:line: rule: message`.

The function returns an object of this shape. Every field is optional. `program/audit.js` is the source of these fields.

```ts
{
	isPure?: (file: string) => boolean
	isTransparent?: (file: string) => boolean
	isRuntimeOwned?: (file: string) => boolean
	visit?: (
		source: ts.SourceFile,
		file: string,
		impure: (node: ts.Node, reason: string) => void,
	) => void
	finish?: () => void
}
```

- `isPure(file)` returns true for another file that must stay pure, such as a frontend update function.
- `isTransparent(file)` returns true for a pure file whose imports `check-program` does not follow.
- `isRuntimeOwned(file)` returns true for a file a pure module must not import.
- `visit` runs once per file, and `impure(node, reason)` marks a node as runtime code.
- `finish` runs after every file.

## If you change this package

Read [AGENTS.md](AGENTS.md). `bun run test` lints the sample projects under `fixtures/`. `bun run check` runs Prettier.
