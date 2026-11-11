# Effect v4 mapping

The target shape for the plan. Use this layout and these constructs by default. Deviate only where the model records a reason in `evidence`. The installed guides name every file and symbol. `docs/NAMING.md` covers services, stores and layers, `docs/SCHEMA.md` covers schemas and errors, and `docs/CONTEXTS.md` covers entries and imports. This page says which construct each model element becomes. Where it and a guide disagree, the guide wins.

## Contents

- Import paths
- Target layout
- Concept to construct
- Code shapes
- Aggregates stored as events
- Step order
- Rules for every step

For a frontend, also read [frontend.md](frontend.md).

## Import paths

The `effect` package holds `effect` (core, `Schema`, `Context`, `Layer`), `effect/schema` (`Model`), `effect/sql`, `effect/http`, `effect/http-api`, `effect/rpc` and `effect/reactivity`. Database drivers are separate packages, such as `@effect/sql-pg`. Never import from `effect/unstable/*`.

## Target layout

One folder per bounded context, at `repo.layout.contextRoot`. The default is `src/<context>`. This is the layout for aggregates whose `persistence.strategy` is `state`, which is the default. [Aggregates stored as events](#aggregates-stored-as-events) adds to it.

```
src/<context>/
  index.ts                          server entry: the service modules, as namespaces
  contract/
    index.ts                        ids, schemas, errors and endpoint groups, safe for the browser
    <Context>Group.ts               the HttpApi group, for transport http-api
    <Context>Rpcs.ts                the RPC group, for transport rpc
  browser.ts                        the layer that runs the context in the browser, for transport local
  domain/
    <Concept>.ts                    one concept: its schema, id, pure rules and errors
    <Capability>.ts                 checks and errors that no one concept owns, such as Access
  application/
    <Concepts>.ts                   the concept's service: its commands and queries
    <Concept>Store.ts               the port the service reads and writes through
    <External>.ts                   the port of an external system
  infrastructure/
    <Technology>/<Concept>Store.ts  the store's adapter, such as Postgres/OrderStore.ts
    <Technology>/<External>.ts      the external system's adapter
    From<Upstream>.ts               the translation from an upstream context
    Http/<Context>Handlers.ts       the server handlers, for transport http-api
    <Context>Layer.ts               the layer that builds the context's services and handlers
```

These rules hold in any project:

- One folder or package per context.
- `domain/` imports only `effect` and other files in `domain/`.
- `contract/` is safe for the browser.
- Other contexts import only a context's entries: `index.ts`, `contract/` or `browser.ts`.
- `infrastructure/` is the only place that knows about storage and outside systems.

Where contexts live, the naming style and where the frontend lives follow the project. In a monorepo, each context can be a package whose `exports` expose only its entries. A codebase grouped by technical type, such as `controllers/`, `services/` and `models/`, is not a convention to keep. The refactor replaces that grouping.

## Concept to construct

The model and the contract use the constructs in the first table, so every context describes itself the same way. The implementation in the second table has a fixed shape but no fixed API. Pick the Effect APIs that fit each piece. Prefer Effect's modules over hand-written code or other libraries, and never assume a storage or a runtime the model doesn't name.

### Model and contract

| Model element               | Effect v4 construct                                                                                                       | File                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Value object, `kind: id`    | a member of its concept, `export const Id = Schema.Int.pipe(Schema.brand("OrderId"))`, read as `Order.Id`                 | `domain/<Concept>.ts`        |
| Value object, `kind: value` | `Schema.Class`, with its rules as checks. A member of its concept unless it has operations of its own and no single owner | `domain/<Concept>.ts`        |
| Entity inside an aggregate  | `Schema.Class` with a branded id field                                                                                    | `domain/<Concept>.ts`        |
| Aggregate                   | one `Schema.Class`. Several states with different fields become one `Schema.TaggedClass` each, joined in a tagged union   | `domain/<Concept>.ts`        |
| Invariant                   | a check in the pure function that changes the aggregate, which fails with the invariant's error                           | `domain/<Concept>.ts`        |
| Domain error                | `Schema.TaggedError` in the module of the concept whose rule raises it. `docs/SCHEMA.md` names it                         | `domain/<Concept>.ts`        |
| Contract                    | the domain modules re-exported as namespaces, and the endpoint groups                                                     | `contract/index.ts`          |
| Transport `http-api`        | `HttpApiGroup.make` with one endpoint per command and query                                                               | `contract/<Context>Group.ts` |
| Transport `rpc`             | `RpcGroup.make` from the contract schemas                                                                                 | `contract/<Context>Rpcs.ts`  |

### Implementation

| Model element                      | Shape                                                                                                   | File                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Command or query                   | an `Effect.fn` method of the concept's service: read through the store, apply the rule, write           | `application/<Concepts>.ts`                |
| Store                              | a port with the reads and writes the service needs, and an adapter per technology                       | `application/`, `infrastructure/`          |
| Policy, trigger `after`, eventual  | the command's method starts the work in a fiber that the service's layer owns                           | `application/<Concepts>.ts`                |
| Policy, `timing: same-transaction` | a second write in the same command method, in one storage transaction                                   | `application/<Concepts>.ts`                |
| Policy, schedule trigger           | a fiber the context's layer starts, on a `Schedule` or a `Cron`, that calls one service method          | `infrastructure/<Context>Layer.ts`         |
| External system                    | a port in `application/`, and an adapter layer in `infrastructure/`                                     | `application/`, `infrastructure/`          |
| Relation with `translation: acl`   | the downstream context turns what it reads upstream into its own concepts                               | `infrastructure/From<Upstream>.ts`         |
| Signed-in person                   | a request service, such as `CurrentActor.Service`, that the middleware provides and each command yields | `application/`                             |
| Current time                       | `DateTime.now` or `Clock`, so tests control time                                                        | anywhere                                   |
| Transport handlers                 | one handler per endpoint, each calling one service method                                               | `infrastructure/Http/<Context>Handlers.ts` |
| Transport `local`                  | `browser.ts` builds the context's layer with stores on the browser storage in `repo.storage`            | `browser.ts`                               |
| Transport `other`                  | the existing mechanism, with each handler calling one service method                                    | existing files                             |

## Code shapes

The examples use an online shop. The `ordering` context owns the `Order` aggregate.

The concept module holds the aggregate's schema, its id, its errors, and one pure function per change. Each function checks the rules and returns the changed record, or fails with a rule's error. It needs no services.

```ts
import { DateTime, Effect, Option, Schema } from "effect"
import * as Money from "./Money"

/** The id of an order. */
export const Id = Schema.Int.pipe(Schema.brand("OrderId"))
export type Id = typeof Id.Type

export const Status = Schema.Literals(["Draft", "Placed"])

/** What a customer buys in one checkout. */
export class Order extends Schema.Class<Order, { readonly brand: unique symbol }>("Order")({
	id: Id,
	status: Status,
	total: Money.Money,
	placedAt: Schema.Option(Schema.DateTimeUtc),
}) {}

/** The customer tried to place the same order twice. */
export class AlreadyPlacedError extends Schema.TaggedError<AlreadyPlacedError, { readonly brand: unique symbol }>()(
	"OrderAlreadyPlacedError",
	{ id: Id },
	{ httpApiStatus: 409 }
) {}

/** Places a draft order. Refuses one already placed. */
export const place = Effect.fn("Order.place")(function* (order: Order, at: DateTime.Utc) {
	if (order.status === "Placed") return yield* new AlreadyPlacedError({ id: order.id })
	return Order.make({ ...order, status: "Placed", placedAt: Option.some(at) })
})
```

Name each function after the command's verb: `place` for `PlaceOrder`. Errors of a capability that no one concept owns, such as a missing sign-in or permission, form one module named for it, such as `Access.ts`.

The service module holds one service, as `docs/NAMING.md` shapes it. A command reads through the store, applies the domain function, and writes the result. It holds no rules.

```ts
import { Context, DateTime, Effect, Layer } from "effect"
import * as Order from "../domain/Order"
import * as OrderStore from "./OrderStore"
import type { UnavailableError } from "../../UnavailableError"

export interface Shape {
	readonly place: (
		id: Order.Id
	) => Effect.Effect<Order.Order, Order.NotFoundError | Order.AlreadyPlacedError | UnavailableError>
}

export class Service extends Context.Service<Service, Shape>()("shop/ordering/application/Orders/Service") {}

const make = Effect.gen(function* () {
	const orders = yield* OrderStore.Service

	const place = Effect.fn("Orders.place")(function* (id: Order.Id) {
		const order = yield* orders.get(id)
		const placed = yield* Order.place(order, yield* DateTime.now)
		return yield* orders.save(placed)
	})

	return Service.of({ place })
})

export const layer = Layer.effect(Service)(make)
```

The store port lists the reads and writes the service needs. Its adapter in `infrastructure/Postgres/OrderStore.ts` holds the SQL and the row shape, and exports its own `layer`.

The contract re-exports the domain modules and adds the endpoint group. It imports only `effect` and files in `domain/`, so a browser bundle can include it.

```ts
// contract/index.ts
export * as Money from "../domain/Money"
export * as Order from "../domain/Order"
export * as OrderingGroup from "./OrderingGroup"
```

The transport the model names in `repo.frontend.transport` decides the group. In refactor mode, keep the transport the code uses today. Changing it is a behavior change and needs a resolved tension. An error's HTTP status is part of its class, so the group only lists the errors.

```ts
// contract/OrderingGroup.ts
export class OrdersGroup extends HttpApiGroup.make("Orders").add(
	HttpApiEndpoint.post("placeOrder", "/orders/:id/place", {
		params: { id: Order.Id },
		success: Order.Order,
		error: [Order.NotFoundError, Order.AlreadyPlacedError],
	})
) {}
```

Handlers call one service method each and hold no logic:

```ts
export const layer = HttpApiBuilder.group(ShopApi, "Orders", (handlers) =>
	Effect.gen(function* () {
		const orders = yield* Orders.Service
		return handlers.handle("placeOrder", ({ params }) => orders.place(params.id))
	})
)
```

### Store failures

A store's failures split by what a caller can do with them:

| The database                                                                                                                    | The store answers                                                                     | The API answers                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Refuses a write with a constraint that guards a domain rule, such as a unique username or a foreign key from accounts to a role | The rule's domain error, such as `User.UsernameTakenError` or `Role.InUseError`       | The error's own status                                                                                 |
| Touches no row on an update or delete                                                                                           | The record's `NotFoundError`                                                          | 404                                                                                                    |
| Is unreachable, deadlocked or timed out, still after a few short retries                                                        | The app's one shared `UnavailableError`, after logging the store's name and the cause | 503: the error carries `httpApiStatus: 503`, and one API-wide middleware declares it on every endpoint |
| Rejects invalid SQL or a check constraint, or returns a row that doesn't decode                                                 | Nothing: it dies, because the code is wrong                                           | 500, logged by the server                                                                              |

- A rule that spans many records, such as a unique name, belongs to a database constraint. A lookup before the write races with a concurrent write, so the service doesn't repeat the check.
- Two shared functions in a module outside the contexts, such as `src/Postgres/sqlFailures.ts`, sort the failures of every store. `refusedBy({ users_username_key: () => new User.UsernameTakenError(…) })` turns the listed constraints into their domain errors. `retryOrUnavailable("UserStore")` retries, then answers `UnavailableError` or dies.
- A write runs `refusedBy`, then `retryOrUnavailable`. A read runs only `retryOrUnavailable`. Type `refusedBy` so that it doesn't compile after `retryOrUnavailable`, which would already have turned the refusal into a defect.
- `UnavailableError` lives in its own pure module outside the contexts, such as `src/UnavailableError.ts`, imported by name. Every port and every service fails with it and passes it through, so a service's type never names the stores it reads. It isn't a domain rejection, so it doesn't go in the model's `errors`.
- Never wrap every failure in one error with a cause, and never `Effect.orDie` the first three rows of the table. No caller can act on either.

Tests use `@effect/vitest`. `docs/TESTING.md` says what to test in each folder, and how to name a test.

## Aggregates stored as events

When an aggregate's `persistence.strategy` is `events`, because the code already stores events, its module adds:

- one `Schema.TaggedClass` per command and per event, each joined in a tagged union;
- one decide function per command, which checks the rules and returns events;
- an `evolve` function, which applies one event to a state.

```ts
export const place = Effect.fn("Order.place")(function* (state: Order, command: PlaceOrder) {
	if (state._tag === "PlacedOrder") return yield* new AlreadyPlacedError({ id: command.id })
	const placedAt = yield* DateTime.now
	return [OrderPlaced.make({ id: command.id, placedAt })]
})

export const evolve = (state: Order, event: OrderEvent): Order =>
	OrderEvent.match(event, {
		OrderPlaced: (placed) => PlacedOrder.make({ id: state.id, total: state.total, placedAt: placed.placedAt }),
	})
```

Its service loads the events, decides, saves the new events, and publishes them. A policy triggered by an event subscribes to the context's event service in `application/`. A model lists an event only when a policy or a relation reads it, or when its aggregate is stored as events.

## Step order

Plan the steps in the order for `repo.mode`. Split a step per aggregate or per context when it would touch more than about 15 files.

### Refactor

1. Create the context folders and value objects. Point existing code at the new types.
2. Add domain errors.
3. Add each concept module with its rules and tests. Nothing calls it yet.
4. Add each store's port, and its adapter that wraps the existing data access.
5. Add each service. Move callers to it one command or query at a time. Delete each old function once nothing calls it.
6. Add the policies. Delete the hooks, listeners and callbacks they replace.
7. Add ports and adapters for external systems, and the translation for each `acl` relation.
8. Add each context's `contract/index.ts`. Add the endpoint groups that `repo.frontend.transport` calls for, and serve them next to the existing endpoints.
9. If `repo.frontend.kind` is not `none`, move the frontend onto the contracts. [frontend.md](frontend.md) gives the steps.
10. Rename what is left to the glossary terms in each `retire` list.
11. Build the application layer from each context's `layer`. Delete dead modules and endpoints that nothing calls.
12. Finish the docs. See "Last step" below.

### Greenfield

1. Set up the project: `package.json` with `effect`, `@effect/vitest`, `vitest`, `typescript` and the `repo.storage` package, a `tsconfig.json`, and the scripts that `repo.checks` runs. Skip what already exists.
2. Create the context folders and value objects, with a test for each rule.
3. Add domain errors.
4. Add each concept module with its rules and tests.
5. Add each store's port, and its adapter on `repo.storage` with its migrations.
6. Add each service, with tests on test layers.
7. Add the policies.
8. Add ports and adapters for external systems, and the translation for each `acl` relation.
9. Add each context's `contract/index.ts` and the endpoint groups that `repo.frontend.transport` calls for.
10. If `repo.frontend.kind` is not `none`, build the frontend on the contracts. [frontend.md](frontend.md) gives the layout.
11. Build the application layer from each context's `layer`, and the entry point that serves it, such as `Layer.launch` with `NodeRuntime.runMain`.
12. Finish the docs. See "Last step" below.

### Last step

1. Check `docs/domain` against the code: every folder and file it names exists, and every name matches. Fix the model where they differ, then render the docs again.
2. Make the edits this step lists for the project's existing docs.
3. Add one line to `AGENTS.md` or `CLAUDE.md`: "Domain docs are in docs/domain/README.md."
4. Update `domain-model.json` to match the code, including each context's `module` and each term's `retire` list. [model-format.md](model-format.md) says why the file stays.

## Rules for every step

- Leave `repo.checks` passing at the end of each step.
- Use glossary terms for every name the step creates.
- Keep the import rules in [Target layout](#target-layout).
- Refactor: keep behavior unchanged. A behavior change needs a tension with a resolution in the model.
- Greenfield: build only what the model holds. Anything else needs a model change first.
