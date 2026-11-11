# Contexts and slices

A bounded context is one part of the business, in one folder, where each word has one meaning. Code outside the folder reaches it only through its entry files, listed below.

`contexts` in `architecture.config.ts` names each context folder, from the `module` of each context in `domain-model.json`. A workspace package is one way to host a context. After you move files or change imports, run lint and `bunx effect-domain check-program`.

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

Within a slice, `domain/` holds browser-only concepts and `presentation/` holds pure view data. Both are pure, like a context's `domain/`. How the frontend holds state belongs to its framework.

## Where code goes

| Code                                                            | Goes in                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| A schema, field meaning, or pure domain rule                    | The context's `domain/`                                          |
| A domain concept every context uses with the same meaning       | The shared kernel, the folder `sharedKernel` names               |
| A helper that names no domain concept, used by several packages | A folder `sharedLibraries` lists                                 |
| A read or a rule over storage                                   | A service module in the context's `application/`                 |
| A database or search engine query                               | The context's `infrastructure/`                                  |
| An HTTP endpoint                                                | Its group in the context's `contract`, its handler on the server |
| Workflow or URL state                                           | The frontend slice's `domain/` or state                          |
| Display used by several slices                                  | A slice of its own that they import through its entry            |

## Share a kernel

A shared kernel is a small set of domain concepts that several contexts use with the same meaning, such as who changed a record and when. `sharedKernel` in `architecture.config.ts` names its one folder, such as `src/kernel`. Code outside it imports it through its `index.ts`, the way it imports a context:

```ts
// src/kernel/index.ts
export * as ChangeLog from "./ChangeLog"
export * as Page from "./Page"

// src/documents/domain/Attachment.ts
import { ChangeLog } from "#kernel"
```

check-program holds the kernel to these rules:

| Rule                                                                                                   | Check                                                   |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Each module is a domain concept module, with the same checks as a module in a context's `domain/`      | `narrow-module`, `concept-namespace`, `codec-placement` |
| It is pure, like a `domain/` module                                                                    | `pure-execution`                                        |
| It imports only itself and packages, type-only imports included, so it never ties every context to one | `kernel-import`                                         |
| Code outside imports it only through its entry                                                         | `public-slice-import`                                   |

Put a concept in the kernel only when two contexts or more use it and it means the same in each. A concept that one context owns stays in that context's `domain/`, and other contexts read it through that context's `contract`. Every change to the kernel changes every context that uses it, so keep it small.

## Don't

- Put no domain schema, mapper, or label in a shared library.
- Add no file that only re-exports, outside an entry.
- Add no `domain/index.ts` barrel in a context. The context's entry is the barrel.
- Put no endpoints of two resources in one HttpApi group. Make one group per resource, composed in the context's `contract`.
- Derive types from the schema, never in a `types.ts` beside it.
