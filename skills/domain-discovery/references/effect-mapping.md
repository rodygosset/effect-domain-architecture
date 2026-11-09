# Effect v4 mapping

The target shape for the plan. Use this layout and these constructs by default. Deviate only where the model records a reason in `evidence`.

## Contents

- Import paths
- Target layout
- Concept to construct
- Code shapes
- Step order
- Rules for every step

For a frontend, also read [frontend.md](frontend.md).

## Import paths

Effect 4 stable ships these modules inside the `effect` package: `effect` (core, `Schema`, `Context`, `Layer`), `effect/schema` (`Model`), `effect/sql`, `effect/http`, `effect/http-api`, `effect/rpc` and `effect/reactivity`. Database drivers are separate packages, such as `@effect/sql-pg`. Never import from `effect/unstable/*`, which only beta versions had.

## Target layout

One folder per bounded context, at `repo.layout.contextRoot`. The default is `src/<context>`. Server code in another context imports it through `index.ts`. Browser code imports it through `contract/`, or through `browser.ts` when the context runs in the browser.

```
src/<context>/
  index.ts                         server API: service classes and <Context>Live
  contract/
    index.ts                       browser-safe schemas: ids, values, commands, queries, events, errors
    Rpc.ts or HttpApi.ts           browser-safe transport definition, when the transport needs one
  browser.ts                       layer that runs the context in the browser, for transport local only
  domain/
    <Aggregate>.ts                 the concept: states, id and other members, commands, events, decide,
                                   evolve, and the errors its rules raise
    <Value>.ts                     a value with operations of its own and no single owner, such as Money
    <Capability>.ts                errors and checks of a capability no one concept owns, such as Access
    <Aggregate>Repository.ts       repository interface only, no storage details
  application/
    <Aggregate>Commands.ts         one method per command
    <Context>Queries.ts            read operations
    <Context>Events.ts             in-process event bus
    policies.ts                    reactions to events and schedules
  infrastructure/
    <Storage><Aggregate>Repository.ts   repository layer on the storage in repo.storage
    Memory<Aggregate>Repository.ts      repository layer for tests
    <External>.ts                  adapter for an external system
    From<Upstream>.ts              translation from an upstream context
    RpcHandlers.ts or HttpApiHandlers.ts   server handlers for the transport
```

### Fixed rules and adaptable placement

These boundary rules never change. They are what make the design pay off:

- One folder or package per context.
- `domain/` imports only `effect` and other files in `domain/`.
- `contract/` is safe for the browser.
- Other contexts import only the public entry point: `index.ts`, `contract/` or `browser.ts`.
- `infrastructure/` is the only place that knows about storage and outside systems.

Placement adapts to the project's conventions: where contexts live, folder and file naming style, where the frontend lives. In a monorepo, each context can be a package whose `exports` expose only its entry points.

A codebase grouped by technical type, such as `controllers/`, `services/` and `models/`, is not a convention to keep. It is the grouping the refactor replaces.

## Concept to construct

Two kinds of guidance:

- The model and the contract use the constructs in the first table. These are how every context describes itself, so they stay the same everywhere.
- The implementation has a fixed shape, in the second table, but no fixed API. Pick the Effect APIs that fit each piece and the technology behind it. Prefer Effect's modules over hand-written code or other libraries. Never assume a storage or a runtime the model does not name.

### Model and contract

| Model element               | Effect v4 construct                                                                                                                                                                             | File                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Value object, `kind: id`    | a member, `export const Id = Schema.String.pipe(Schema.brand("OrderId"))`, read as `Order.Id`                                                                                                   | `domain/<Aggregate>.ts`                        |
| Value object, `kind: value` | `Schema.Class`, rules as `Schema.check(...)`. A member of its concept unless it has operations and no single owner                                                                              | `domain/<Aggregate>.ts` or `domain/<Value>.ts` |
| Entity inside an aggregate  | `Schema.Class` with a branded id field                                                                                                                                                          | `domain/<Aggregate>.ts`                        |
| Aggregate state             | one `Schema.TaggedClass` per state, joined with `Schema.Union([...]).pipe(Schema.toTaggedUnion("_tag"))`                                                                                        | `domain/<Aggregate>.ts`                        |
| Command                     | `Schema.TaggedClass`, joined per aggregate with `toTaggedUnion`                                                                                                                                 | `domain/<Aggregate>.ts`                        |
| Event                       | `Schema.TaggedClass`, joined per aggregate with `toTaggedUnion`                                                                                                                                 | `domain/<Aggregate>.ts`                        |
| Invariant                   | a check inside the decide function that fails with the invariant's error                                                                                                                        | `domain/<Aggregate>.ts`                        |
| Domain error                | `Schema.TaggedError`, in the module of the concept whose rule raises it, named with `Error` and a tag that keeps the concept's words: `Order.AlreadyPlacedError` is `"OrderAlreadyPlacedError"` | `domain/<Aggregate>.ts`                        |
| Repository interface        | `Context.Service` whose methods speak in aggregate states                                                                                                                                       | `domain/<Aggregate>Repository.ts`              |
| Contract                    | schemas re-exported from `domain/`, plus one `Schema.TaggedClass` per query and a schema for its result                                                                                         | `contract/index.ts`                            |
| Transport `rpc`             | `RpcGroup.make` from the contract schemas                                                                                                                                                       | `contract/Rpc.ts`                              |
| Transport `http-api`        | `HttpApiGroup.make` with one endpoint per command and query, errors annotated with `HttpApiSchema.status`                                                                                       | `contract/HttpApi.ts`                          |

### Implementation

| Model element                            | Shape                                                                                              | File                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Repository                               | a layer for the storage in `repo.storage`, and a memory layer for tests                            | `infrastructure/`                                                      |
| Command handling                         | `Context.Service` with one `Effect.fn` method per command: load, decide, save, publish             | `application/<Aggregate>Commands.ts`                                   |
| Query                                    | `Context.Service` with one method per query, reading from whatever stores the data                 | `application/<Context>Queries.ts`                                      |
| Event bus                                | `Context.Service` that publishes a context's events and lets others subscribe                      | `application/<Context>Events.ts`                                       |
| Policy, `timing: eventual`               | a reaction that runs after its event and calls one command method                                  | `application/policies.ts`                                              |
| Policy, `timing: same-transaction`       | a second step in the same command method, in one storage transaction                               | `application/<Aggregate>Commands.ts`                                   |
| Policy, schedule trigger                 | a reaction that runs on its schedule and calls one command method                                  | `application/policies.ts`                                              |
| External system                          | `Context.Service` port in `application/`, adapter layer in `infrastructure/`                       | `infrastructure/<External>.ts`                                         |
| Relation with `translation: acl`         | the downstream context turns upstream events or calls into its own commands                        | `infrastructure/From<Upstream>.ts`                                     |
| Current time                             | `DateTime.now` or `Clock`, so tests control time                                                   | anywhere                                                               |
| New ids                                  | a small `Context.Service` per id kind, so tests fix the values                                     | `application/`                                                         |
| Transport handlers                       | one handler per command and query, each calling one service method                                 | `infrastructure/RpcHandlers.ts` or `infrastructure/HttpApiHandlers.ts` |
| Transport `local`                        | `browser.ts` builds the context's layer with repositories on the browser storage in `repo.storage` | `browser.ts`                                                           |
| Transport `other` and other entry points | the existing mechanism, with each handler calling one service method                               | existing files                                                         |

## Code shapes

The examples use an online shop. The `ordering` context owns the `Order` aggregate.

Aggregate module. One decide function per command checks the rules and returns events. `evolve` applies one event. Both are pure and need no services.

```ts
import { DateTime, Effect, Schema } from "effect"
import * as Money from "./Money.ts"

export const Id = Schema.String.pipe(Schema.brand("OrderId"))
export type Id = typeof Id.Type

/** The customer tried to place the same order twice. */
export class AlreadyPlacedError extends Schema.TaggedError<AlreadyPlacedError>()("OrderAlreadyPlacedError", {
	id: Id,
}) {}

export class DraftOrder extends Schema.TaggedClass<DraftOrder>()("DraftOrder", {
	id: Id,
	total: Money.Money,
}) {}

export class PlacedOrder extends Schema.TaggedClass<PlacedOrder>()("PlacedOrder", {
	id: Id,
	total: Money.Money,
	placedAt: Schema.DateTimeUtc,
}) {}

export const Order = Schema.Union([DraftOrder, PlacedOrder]).pipe(Schema.toTaggedUnion("_tag"))
export type Order = typeof Order.Type

export class PlaceOrder extends Schema.TaggedClass<PlaceOrder>()("PlaceOrder", {
	id: Id,
}) {}

export class OrderPlaced extends Schema.TaggedClass<OrderPlaced>()("OrderPlaced", {
	id: Id,
	placedAt: Schema.DateTimeUtc,
}) {}

export const OrderEvent = Schema.Union([OrderPlaced]).pipe(Schema.toTaggedUnion("_tag"))
export type OrderEvent = typeof OrderEvent.Type

export const place = Effect.fn("Order.place")(function* (state: Order, command: PlaceOrder) {
	if (state._tag === "PlacedOrder") {
		return yield* new AlreadyPlacedError({ id: command.id })
	}
	const placedAt = yield* DateTime.now
	return [new OrderPlaced({ id: command.id, placedAt })]
})

export const evolve = (state: Order, event: OrderEvent): Order =>
	OrderEvent.match(event, {
		OrderPlaced: (e) => new PlacedOrder({ id: state.id, total: state.total, placedAt: e.placedAt }),
	})
```

Name each decide function after the command's verb: `place` for `PlaceOrder`.

The errors live in the aggregate module above, beside the rules that raise them. Code reads `Order.AlreadyPlacedError`, and the tag `"OrderAlreadyPlacedError"` keeps the concept's words, so tags stay unique across the API. Errors of a capability that no one concept owns, such as a missing sign-in or permission, form one module named for it: `Access.ts` with `Access.NotSignedInError` and `Access.PermissionDeniedError`. A module that would hold one error and nothing else fails check-program's `narrow-module` check.

Command service. It loads, decides, saves and publishes. It holds no rules. It imports the aggregate module as a namespace: `import * as Order from "../domain/Order.ts"`.

```ts
export class OrderCommands extends Context.Service<
	OrderCommands,
	{
		place(command: Order.PlaceOrder): Effect.Effect<void, Order.AlreadyPlacedError | Order.NotFoundError>
	}
>()("app/ordering/OrderCommands") {
	static readonly layerNoDeps = Layer.effect(
		OrderCommands,
		Effect.gen(function* () {
			const repository = yield* OrderRepository
			const events = yield* OrderingEvents

			const place = Effect.fn("OrderCommands.place")(function* (command: Order.PlaceOrder) {
				const state = yield* repository.get(command.id)
				const emitted = yield* Order.place(state, command)
				yield* repository.save(emitted.reduce(Order.evolve, state))
				yield* events.publishAll(emitted)
			})

			return OrderCommands.of({ place })
		})
	)

	static readonly layer = this.layerNoDeps.pipe(Layer.provide([OrderRepositoryLive, OrderingEvents.layer]))

	static readonly layerTest = this.layerNoDeps.pipe(
		Layer.provideMerge([MemoryOrderRepository.layerTest, OrderingEvents.layer])
	)
}
```

`OrderRepositoryLive` is the repository layer for the storage in `repo.storage`. Its storage shape and its conversion to aggregate states stay in `infrastructure/`. For SQL through `effect/sql`, that means a `Model.Class` row and `SqlModel.makeRepository`.

Contract. It re-exports domain schemas and adds the query schemas. It imports only `effect` and files in `domain/`, so a browser bundle can include it.

```ts
export * as Money from "../domain/Money.ts"
export * as Order from "../domain/Order.ts"
export * as OrderQueries from "./OrderQueries.ts"
```

`contract/OrderQueries.ts` holds the query schemas:

```ts
import { Schema } from "effect"
import * as Order from "../domain/Order.ts"

export class ListDraftOrders extends Schema.TaggedClass<ListDraftOrders>()("ListDraftOrders", {}) {}
export const DraftOrders = Schema.Array(Order.DraftOrder)
```

The transport the model names in `repo.frontend.transport` decides what comes next. In refactor mode, keep the transport the code uses today. Changing it is a behavior change and needs a resolved tension.

Transport `rpc`, in `contract/Rpc.ts`:

```ts
export const OrderingRpcs = RpcGroup.make(
	Rpc.make("PlaceOrder", {
		payload: PlaceOrder,
		error: Schema.Union([Order.AlreadyPlacedError, Order.NotFoundError]),
	}),
	Rpc.make("ListDraftOrders", { payload: ListDraftOrders, success: DraftOrders }),
	Rpc.make("WatchOrders", { success: OrderEvent, stream: true })
)
```

Transport `http-api`, in `contract/HttpApi.ts`. HTTP status codes live here, never in `domain/`:

```ts
export class OrderingApi extends HttpApiGroup.make("ordering").add(
	HttpApiEndpoint.post("placeOrder", "/orders/:id/place", {
		params: { id: OrderId },
		error: [
			Order.AlreadyPlacedError.pipe(HttpApiSchema.status(409)),
			Order.NotFoundError.pipe(HttpApiSchema.status(404)),
		],
	}),
	HttpApiEndpoint.get("listDraftOrders", "/orders/drafts", { success: DraftOrders })
) {}
```

Handlers call one service method each and hold no logic:

```ts
export const OrderingRpcHandlers = OrderingRpcs.toLayer(
	Effect.gen(function* () {
		const commands = yield* OrderCommands
		const queries = yield* OrderingQueries
		const events = yield* OrderingEvents
		return {
			PlaceOrder: (command) => commands.place(command),
			ListDraftOrders: (query) => queries.listDraftOrders(query),
			WatchOrders: () => events.subscribe,
		}
	})
)
```

A store's failures split by what a caller can do with them:

| The database                                                                                                                    | The store answers                                                                     | The API answers                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Refuses a write with a constraint that guards a domain rule, such as a unique username or a foreign key from accounts to a role | The rule's domain error, such as `User.UsernameTakenError` or `Role.InUseError`       | The error's own status                                                                                 |
| Touches no row on an update or delete                                                                                           | The record's `NotFoundError`                                                          | 404                                                                                                    |
| Is unreachable, deadlocked or timed out, still after a few short retries                                                        | The app's one shared `UnavailableError`, after logging the store's name and the cause | 503: the error carries `httpApiStatus: 503`, and one API-wide middleware declares it on every endpoint |
| Rejects invalid SQL or a check constraint, or returns a row that doesn't decode                                                 | Nothing: it dies, because the code is wrong                                           | 500, logged by the server                                                                              |

A rule that spans many records, such as a unique name, belongs to the database constraint, not to a lookup before the write: the lookup races with a concurrent write. The command service doesn't repeat it. Never wrap every failure in one error with a cause: no caller can act on it. Never use `Effect.orDie` for the first three rows. `UnavailableError` lives in its own pure module outside the contexts, `src/UnavailableError.ts`, imported by name as `import { UnavailableError } from "…/UnavailableError"`, because it belongs to no concept that a namespace could name. Every port and every command service fails with that class and passes it through untouched. A service's signature then never says which stores it reads, and a store can move to another backend without changing it. It is not a domain rejection, so it doesn't go in `errors`.

Tests use `@effect/vitest`. Aggregate tests call decide functions with a state and assert the events or the error. Command service tests provide `layerTest`. Name each test after the rule it proves, in glossary terms: `"rejects placing an order twice"`. `docs/TESTING.md` covers the rest: what to test in each folder, test layers, and what not to test.

## Step order

Plan the steps in the order for `repo.mode`. Split a step per aggregate or per context when it would touch more than about 15 files.

### Refactor

1. Create the context folders and value objects. Point existing code at the new types.
2. Add domain errors.
3. Add each aggregate module with its tests. Nothing calls it yet.
4. Add the repository interface, the storage layer that wraps the existing data access, and the memory layer.
5. Add each command service. Move callers to it one command at a time. Delete each old function once nothing calls it.
6. Add the event buses and policies. Delete the hooks, listeners and callbacks they replace.
7. Add query services and move read callers.
8. Add ports and adapters for external systems, and the translation for each `acl` relation.
9. Add each context's `contract/index.ts`. Add the transport files that `repo.frontend.transport` calls for, and serve them next to the existing endpoints.
10. If `repo.frontend.kind` is not `none`, move the frontend onto the contracts. [frontend.md](frontend.md) gives the steps.
11. Rename what is left to the glossary terms in each `retire` list.
12. Build the application layer from each context's `layer`. Delete dead modules and endpoints that nothing calls.
13. Finish the docs. See "Last step" below.

### Greenfield

1. Set up the project: `package.json` with `effect`, `@effect/vitest`, `vitest`, `typescript` and the `repo.storage` package, a `tsconfig.json`, and the scripts that `repo.checks` runs. Skip what already exists.
2. Create the context folders and value objects, with a test for each rule.
3. Add domain errors.
4. Add each aggregate module with its tests.
5. Add the repository interfaces, the storage layers on `repo.storage` with their migrations, and the memory layers.
6. Add each command service, with tests on its `layerTest`.
7. Add the event buses and policies.
8. Add the query services.
9. Add ports and adapters for external systems, and the translation for each `acl` relation.
10. Add each context's `contract/index.ts` and the transport files that `repo.frontend.transport` calls for.
11. If `repo.frontend.kind` is not `none`, build the frontend on the contracts. [frontend.md](frontend.md) gives the layout.
12. Build the application layer from each context's `layer`, and the entry point that serves it, such as `Layer.launch` with `NodeRuntime.runMain`.
13. Finish the docs. See "Last step" below.

### Last step

Check `docs/domain` against the code: every folder and file it names exists, and every name matches. Fix the docs where they differ. Make the edits this step lists for the project's existing docs. Add one line to `AGENTS.md` or `CLAUDE.md`: "Domain docs are in docs/domain/README.md." Keep `domain-model.json`, because `architecture.config.ts` reads the contexts and the glossary from it. Update it to match the code: each context's `module`, and each term's `retire` list. From here on, `domain-model.json` and the docs rendered from it are the record of the domain.

## Rules for every step

- Leave `repo.checks` passing at the end of each step.
- Use glossary terms for every name the step creates.
- Never import from another context's `domain/`, `application/` or `infrastructure/`. Import its `index.ts`, or from browser code its `contract/` or `browser.ts`.
- Files in `domain/` import only `effect` and other files in `domain/`. Files in `contract/` import only `effect`, `effect/rpc`, `effect/http-api` and `domain/`. This keeps `contract/` safe for the browser.
- Refactor: keep behavior unchanged. A behavior change needs a tension with a resolution in the model.
- Greenfield: build only what the model holds. Anything else needs a model change first.
