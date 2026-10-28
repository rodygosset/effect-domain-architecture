# Contexts and slices

A context is a folder with entry files. A workspace package is one way to host it. `contexts` in `architecture.config.ts` names each context folder, from the `module` of each context in `domain-model.json`. Code outside a context imports it only through its entries. After you move files or change imports, run lint and `bunx effect-domain check-program`.

## Context entries

| Entry        | Who imports it                               | Holds                                                    |
| ------------ | -------------------------------------------- | -------------------------------------------------------- |
| `.`          | Server code, and other contexts' server code | Service modules as namespaces, such as `Orders`          |
| `./contract` | Everyone                                     | Ids, schemas, errors, and HttpApi groups. Nothing impure |
| `./browser`  | Browser code                                 | Browser-only helpers, such as a file download            |

An entry only re-exports modules as namespaces: `export * as Order from "./domain/Order"`. `entryFiles` in the config lists the entry file names. A file inside the same context imports another by relative path, from the module that defines it.

## Layers inside a context

| Folder            | Holds                                                   |
| ----------------- | ------------------------------------------------------- |
| `domain/`         | One concept per module, with its operations. Pure       |
| `application/`    | Services that read and change the domain over storage   |
| `infrastructure/` | Adapters to databases, search engines, and foreign HTTP |
| `contract/`       | What crosses the wire: ids, schemas, errors, HttpApi    |

`domain/` imports nothing impure. check-program follows every value import and fails when a pure module reaches runtime code, such as a `node:` module, a browser global, or `Effect.runPromise`. `runtimeModules` in the config lists the imports that make a module impure.

## Frontend slices

`frontend.root` in the config is the folder of browser workflows. Each PascalCase folder under it is a slice, and one with an `index.ts` is public through it. `frontend.pages` holds one folder per page, and each page's `index` file is its entry. Code in one slice imports another slice only through that entry, and check-program follows path aliases and dynamic imports to enforce it.

A slice may add a second entry made only of re-exports, such as a lazily loaded view. No other module re-exports.

Within a slice, `domain/` holds browser-only concepts and `presentation/` holds pure view data. Both are pure, like a context's `domain/`. How the frontend holds state belongs to its framework. FoldKit, for one, brings its own layout and lint.

## Where code goes

| Code                                                            | Goes in                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| A schema, field meaning, or pure domain rule                    | The context's `domain/`                                          |
| A helper that names no domain concept, used by several packages | A folder `sharedLibraries` lists                                 |
| A read or a rule over storage                                   | A service module in the context's `application/`                 |
| A database or search engine query                               | The context's `infrastructure/`                                  |
| An HTTP endpoint                                                | Its group in the context's `contract`, its handler on the server |
| Workflow or URL state                                           | The frontend slice's `domain/` or state                          |
| Display used by several slices                                  | A slice of its own that they import through its entry            |

## Don't

- Put no domain schema, mapper, or label in a shared library.
- Add no file that only re-exports, outside an entry.
- Add no `domain/index.ts` barrel in a context. The context's entry is the barrel.
- Make one HttpApi group per resource, composed in the context's `contract`.
- Derive types from the schema, never in a `types.ts` beside it.
