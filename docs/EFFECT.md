# Effect tooling

Effect's lint rules win. Pin every Effect package to one exact release, in a catalog when the project is a workspace. `repos/effect` holds a source snapshot of that release, not a Git clone, and `repos/effect-reference.json` records its commit. Agents read that source instead of trusting memory or the web. `bunx effect-domain check-effect-docs` fails when the pins, the installed packages, and the reference disagree. `effect.packages` in `architecture.config.ts` lists each Effect package and the workspace that installs it.

## Upgrade Effect

1. Check the new release against tsgo's supported range in the [Effect devtools guide](https://effect.website/docs/v4/getting-started/devtools) and [tsgo's `upstream.json`](https://github.com/Effect-TS/tsgo/blob/main/_packages/tsgo/upstream.json). Don't upgrade Oxlint past that range on its own.
2. Preview the source diff with `bunx effect-domain sync-effect-reference <full-commit> <version>`. Look at any local changes under `repos/effect` before you replace it.
3. Run the same command with `--write`. Change the snapshot no other way.
4. Set every Effect pin to the new version and run `bun install`.
5. Follow upstream migration notes, then run every check.

## What lint runs

Lint runs type-aware Oxlint with the `@effect/tsgo` presets, then the `effect-domain` plugin through the presets in `lint/presets/`. Every rule is an error, and warnings fail too. Run Oxlint with `--disable-nested-config`, so `repos/effect` can't change the rules.

Turn off `effecttsgo/missing-pipeable-signature`. It asks every exported function for a `dual` pipe overload, but few callers use `pipe`. [GUIDELINES.md](GUIDELINES.md#function-shape) says when to add `dual`.

Add `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`, and `verbatimModuleSyntax` to `strict`. The typed rules and `Option` code assume them. At third-party boundaries, omit an optional key instead of passing `undefined`.

Add a rule only for a mistake agents keep making, give it a fixture, and delete it once the mistake can't happen. `bunx effect-domain check-effect-lint` proves the type-aware runner still rejects Effect mistakes.

## Code shapes

| Shape             | Example                                                  |
| ----------------- | -------------------------------------------------------- |
| Traced function   | `Effect.fn("Orders.place")(function* (order) { … })`     |
| Typed decoder     | `Schema.decodeOption(Schema.FiniteFromString)`           |
| Schema type       | `export type Order = typeof Order.Type`                  |
| Known-valid value | `Order.make({ ...this, status: "Paid" })`                |
| Dual arity        | `dual(2, (order, line) => …)`, tested in both call forms |
| Service key       | `"@acme/ordering/application/Orders/Service"`            |

Changing a service key never changes an HttpApi group ID, which is on the wire.

## Allowed exceptions

Put each suppression on the exact expression, with a reason after `--`, never on a whole application file. `bunx effect-domain check-escape-hatches` fails when a file's suppressions don't match the allowlist, so a reviewer sees each new one. Typical exceptions:

- Synchronous codecs for router URLs and test fixtures validated at module load.
- Native `Date` where a library's API takes one.
- Entry points that provide services right before they run a CLI, route, or loader.
- `X.make({ ...this, field })`. Schema classes hold only data, so the spread loses nothing. Never call a method on a spread copy.
- Signatures that a framework dictates, which `missing-pipeable-signature` would otherwise curry.

Widen input types instead of adding `as` casts.

## Lint fixes

`oxlint --fix` applies ordinary fixes. Never run `--fix-suggestions` across all rules, because some suggestions need judgment.

| Change                                                                   | How                                                                                                |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Type extraction, typed decoders, `.make`, service keys, `Effect.forEach` | Apply those rules' suggestions only, then typecheck                                                |
| Import or API renames from a migration guide                             | A codemod, then typecheck                                                                          |
| Explicit boolean checks                                                  | Codemod clear null, undefined, and string cases. Review numbers and `&&` and `\|\|` values by hand |
| `Schema.Number` to `Schema.FiniteFromString`                             | Confirm the domain excludes `NaN` and infinity, and test that decoding rejects them                |
| Environment, clock, I/O, services, cancellation, errors                  | By hand. Keep ownership, lifetime, timezone, and public behavior, and test the boundary            |
