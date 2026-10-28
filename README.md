# effect-domain-architecture

Docs, skills and lint rules for TypeScript projects built on Effect 4. A project can be full stack, frontend only or backend only. The rules come from [recolnat](https://gitlab.mnhn.cloud/rgosset/recolnat-public), where they ran first.

The framework covers the core and the contexts. That means a domain-driven project layout, one concept per module, and types next to their operations, following Effect's module conventions. State management belongs to the frontend framework.

## What's inside

| Folder       | What it holds                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| `lint/`      | The `effect-domain` oxlint plugin, the `core`, `contexts` and `style` presets, and the FoldKit override |
| `program/`   | `check-program`, the rules that need the TypeScript checker, and the hook for a project's own rules     |
| `scripts/`   | Checks for names, suppressions, cycles, unreachable files and doc paths, and the function-shape fixer   |
| `presets/`   | A knip preset                                                                                           |
| `docs/`      | The guides an agent reads before it writes code                                                         |
| `skills/`    | Agent skills, with domain-discovery among them                                                          |
| `install.ts` | Copies the docs and skills into a project and records their hashes                                      |
| `fixtures/`  | Full-stack, frontend-only and backend-only projects that the tests lint                                 |

## Install

The package is a git dependency until a second project uses it.

```bash
bun add -d github:rodygosset/effect-domain-architecture
```

Then add `architecture.config.ts` at the project root. It reads the contexts and the glossary from `domain-model.json`, which the domain-discovery skill writes.

```ts
import model from "./domain-model.json" with { type: "json" }

export default {
	contexts: model.contexts.map((context) => context.module),
	entryFiles: ["index.ts", "contract/index.ts", "browser.ts"],
	sourceRoots: ["packages/*/src"],
	packageRoots: ["packages/*/src"],
	glossary: model.glossary.map((entry) => ({ term: entry.term, retire: entry.retire })),
}
```

Every key has a default, listed in `config.js`. Extend the presets in `.oxlintrc.json`.

```json
{
	"extends": [
		"./node_modules/effect-domain-architecture/lint/presets/core.json",
		"./node_modules/effect-domain-architecture/lint/presets/contexts.json",
		"./node_modules/effect-domain-architecture/lint/presets/style.json"
	]
}
```

The plugin reads `architecture.config.ts` itself, so `.oxlintrc.json` names no paths the config already holds. Each rule skips the files the config lists under `vendored`.

Run the checks with the `effect-domain` command.

```bash
bunx effect-domain check-program
```

The other commands are `check-naming`, `check-circular`, `check-unreachable`, `check-escape-hatches`, `check-effect-docs`, `check-effect-lint`, `check-no-claude-comments`, `check-commit-message-line-length`, `fix-function-shape`, `sync-effect-reference` and `install`.

## A project's own rules

A project keeps its own oxlint plugin beside this one. For typed rules, list a module under `program.extensions` in `architecture.config.ts`. Its default export receives the TypeScript program and returns hooks. `program/audit.js` documents them.

## FoldKit

A FoldKit project also extends `lint/overrides/foldkit.json`. It switches off the rules that FoldKit's own plugin already runs, so no line is flagged twice.

## Tests

```bash
bun run test
```
