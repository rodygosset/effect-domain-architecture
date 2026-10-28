# Naming

Name a symbol for what it returns or does, with the verbs Effect uses: `make`, `from`, `to`, `decode`, `encode`, `is`, `maybe`. Don't invent new ones. Take domain nouns from the glossary in `domain-model.json`, which the domain-discovery skill writes.

Name an Option local, argument, prop, or getter `maybeName`. Schema fields keep their wire spelling. [SCHEMA.md](SCHEMA.md#absence) has the other Option rules.

## Services

A module holds one service. It exports `Shape`, the service's interface, a `Service` class keyed by its module path, and its layers. Consumers import the module as a namespace, so the module name says which service it is.

```ts
// packages/ordering/src/application/Orders.ts
export interface Shape {
	readonly getById: (id: Order.Id) => Effect.Effect<Order.Order, OrderNotFound | OrderStore.StoreError>
}

export class Service extends Context.Service<Service, Shape>()("@acme/ordering/application/Orders/Service", {
	make,
}) {}

export const layerNoDeps = Layer.effect(Service, Service.make)
export const layer = layerNoDeps.pipe(Layer.provide(PostgresStore.layer))
export const layerDemo = layerNoDeps.pipe(Layer.provide(DemoStore.layer(demoOrders)))
```

```ts
import * as Orders from "./Orders"

const program = Effect.gen(function* () {
	const orders = yield* Orders.Service
	return yield* orders.getById(id)
}).pipe(Effect.provide(Orders.layer))
```

- The key is the module's package path, then the class name. Oxlint's `deterministic-keys` checks it, and `service-module-shape` checks one `Context.Service` class per module, named `Service` (or `Client`), with `Shape` exported.
- A private service in a test file may take a role name such as `ApiClient`, derive its shape from `HttpApiClient.ForApi`, and keep its layer as a static.
- A wire client is `Client`: `PaymentsApi.Client`.
- A context entry exports the module with `export * as Orders from "./application/Orders"`, never a bare `export *`.
- The service's own types live in its module: `OrderStore.StoreError`.

## Layers

Anything that is or returns a `Layer` starts with `layer`. The default is `layer`, and variants add the difference: `layerDemo`, `layerNoDeps`. An adapter module exports its own `layer`, read as `PostgresStore.layer`. Never `Live`, `LiveLayer`, `DemoLayer`, or `postgresLayer`.

## Groups and clients

| Thing                          | Name                                                   | Example              |
| ------------------------------ | ------------------------------------------------------ | -------------------- |
| Domain row                     | Singular noun                                          | `Order`, `Invoice`   |
| HttpApi group                  | The domain name, plural if it would clash with the row | `Orders`             |
| Group class                    | `{GroupId}Group`                                       | `OrdersGroup`        |
| Service wrapping a wire client | `Client` in its module                                 | `PaymentsApi.Client` |

A group's ID (`"Orders"`) is on the wire, so it keeps its name when the service behind it changes. URL paths stay lowercase (`/orders`).

Don't alias the entity (`OrderEntity`) or suffix a service with `Repository`.

## Domain concept modules

A file in `domain/` holds one concept and the operations on it, the way an Effect module holds `Option` and `Option.map`. Callers read it through a namespace named for the file, and context entries export it as one: `export * as OrderLine from "../domain/OrderLine"`.

```ts
import { OrderLine, Product } from "@acme/ordering/contract"

const line = OrderLine.make(Product.getBySku("TEA-01"), { quantity: 2 })
const lines = OrderLine.save(order.lines, line)
const linesSchema = Schema.Array(OrderLine.OrderLine)
```

- The concept's schema and type take the module's name: `OrderLine.OrderLine`. Every other export drops the module's words: `OrderLine.make`, not `makeOrderLine`, and `Money.FromString`, not `MoneyFromString`. check-program rejects a name that repeats its module (`module-prefix`).
- Codecs, constructors, and matchers are module-level exports: `Order.FromRow`, `Invoice.fromOrder`, `OrderStatus.match`. A class's `make` needs the class as `this`, so the module wraps it: `export const make = (input: Parameters<typeof Order.make>[0]): Order => Order.make(input)`. Write no other forwarding wrapper.
- Compose schemas through the schema: `Order.Order.mapFields(…)`, `Order.Status.literals`.
- A value derived from one instance stays a getter: `order.maybeShippedAt`.
- Operations on a list of a concept go in the concept's module, named for what happened to the list: `OrderLine.save(lines, line)`, `OrderLine.remove`. `with` and `delete` can't be export names.
- Give a type its own module only when it has operations of its own (`Money.add`), or more than one concept builds on it (`Address`, for `Customer` and `Shipment`). Otherwise it is a member of its concept: `Order.Id`, `Order.Status`.
- Build a member with its own `make`: `Order.Id.make(…)`. Only the class the module is named for gets a module-level `make`.
- An error has its own module, because its class name is its wire tag and would repeat the concept's name: `OrderNotFound`.
- A domain concept stays in its context's `domain/`, even when it is only math. A shared library holds only helpers that name no domain concept and that more than one package uses.
- Never name a domain module like a global (`Date`, `String`), because its namespace would hide it.
- Import a domain module as a namespace, never by name. A context entry holds only `export * as` lines. check-program rejects both (`concept-namespace`).

## Conversions

| You are                       | Name                                            |
| ----------------------------- | ----------------------------------------------- |
| Building a known-valid value  | `make`, `X.make`, `new X({ … })`                |
| Building from a sibling type  | `fromX`, `X.from`                               |
| Projecting to another type    | `toX`                                           |
| Parsing unknown or wire input | `decodeX` (an Effect) or `maybeX` (an `Option`) |
| Encoding with a codec         | `encodeX`                                       |

`maybe` fails quietly. A parse that can fail with `SchemaError` is `decode`.

Put the verb first: `toCsv(rows)`, `Money.fromCents(cents)`, not `rowsToCsv` or `moneyFromCents`. Lint's `conversion-names` rejects `To` or `From` mid-name unless the name starts with a verb, as `scrollToSection` does. Never name a constructor `fooOf(x)`. Schema and type share one name, never `FooSchema` or `FooType`.

A Schema class's identifier is its name, so errors show the name the code uses: `Schema.Class<OrderLine>("OrderLine")`. An `HttpApi` declares its class name (`HttpApi.make("OrderingApi")`), and a group class is its ID plus `Group`. Lint's `schema-class-identifiers` rejects any other identifier.

Lint rejects a module-level function that starts with a synonym of a listed verb (`no-unlisted-verbs`):

| Don't start with                  | Write                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `create`, `build`                 | `make`: `Invoice.make`                                                                       |
| `compute`, `calculate`, `resolve` | `to`, or the noun for a number: `toTotal`, `lineCount`                                       |
| `equal`                           | `isSame…`, or `isSame = Schema.toEquivalence(X)`                                             |
| `ensure`, `upsert`, `reconcile`   | `sync` when it makes an outside object match the state. `with…` for a copy with one part set |

Union cases follow the same verbs: `SavedLine`, not `UpsertedLine` (`message-verbs`). Name a case for what happened to what, not for the field that changed. A function inside a service's `make` may keep the name of the API it wraps.

## Predicates and lookups

| You are                         | Name                  | Example                  |
| ------------------------------- | --------------------- | ------------------------ |
| Testing a boolean or type guard | `is*`                 | `isPaid`, `Order.isId`   |
| Reading an optional field       | `maybe*`              | `maybeDiscount`          |
| Listing related keys            | Plural noun           | `lineIds`                |
| Computing a number              | The noun, or `clamp*` | `pageCount`, `clampPage` |
| Looking up a catalog entry      | `get*`                | `Product.getBySku`       |

Use `has*` only for "this collection contains".

A function that returns a boolean starts with a word from `predicatePrefixes` in `architecture.config.ts`, by default `is`, `has`, `can` or `should` (`predicate-names`). A function that changes something and reports how it went returns a named status, so the caller reads what happened: `Sync.run(…) === "Inactive"`, not `!Sync.run(…)`.

A boolean field, prop, or parameter states a fact: `isTotalShown`, `hasDiscount`. Never an instruction (`showTotal`, `withDiscount`) or a bare noun (`discount`). Lint's `boolean-names` rejects a boolean starting with `show`, `hide`, `include`, `exclude`, `orderBy`, `with`, `focusOn`, `enable`, `disable`, or `allow`. Review catches a bare noun.

String union members are PascalCase, like tags: `"NotReady"`, `"Shipped"`. Strings another system defines keep its spelling, such as a DOM attribute or a value stored in a database. Lint (`camel-case-literal-unions`) rejects only kebab-case, so review catches the rest.

## Abbreviations

Spell names out, in every word: `definition`, not `def`; `message`, not `msg`. Name a callback parameter for what it holds: `(line) =>`, `(event) =>`, `(left, right) =>` in a sort. Lint's `id-length`, `denied-names`, and `spelled-out-words` reject short words alone or inside a name. `naming.spelledOut` in `architecture.config.ts` adds a project's own, such as `lat` for latitude. Wire spellings pass: object keys, reads such as `bounds.lat`, and snake_case names.

`h` stays for a view builder such as FoldKit's, and `x`, `y`, `z` for coordinates.

An object parameter is `options` for an optional settings object with a default, and `args` everywhere else. A parameter named for its data keeps its name: `order`, `page` (`object-param-names`). A UI framework's components take `props`, which the `propsFunctions` option allows.

## Constants

`const` already marks a constant, so bindings are camelCase: `pageSize`. PascalCase is for Schemas, classes, and services.

Bind a duration as a `Duration` named for its use: `Duration.millis(300)`. A raw number may keep its unit: `retryDelayMs`. Declare a constant beside the code that uses it. A limit leads with `min` or `max`: `Order.maxLines`, not `orderMaxLines`. Names the environment or a spec owns stay: `process.env.PORT`, `"GET"`.

```ts
// Bad
export const DEFAULT_PAGE_SIZE = 50

// Good
export const defaultPageSize = 50
```

## Namespaces

A namespace never takes a JavaScript global's name, which it would hide: a map of orders is `OrderMap`, not `Map` (`no-global-namespace-names`). Effect's `Array`, `Record`, and `String` are the exception.

Modules outside `domain/` that hold one concept and its operations are namespaces too, such as `presentation/*.ts`. `frontend.namespaceModules` in the config lists them. Their members don't repeat the module. A file whose one export takes its name, such as `notifyFailedPayment.ts`, is imported by name. check-program rejects a named import or re-export of a namespace file (`concept-namespace`).

## Files

A file's name tells a reader what is inside before they open it. Finish the sentence "this file holds the …": if the answer needs more words than the name has, the name is too short. `bunx effect-domain check-naming` checks this section.

### Case

Name files and folders in PascalCase or camelCase, never kebab-case or snake_case. A file with one class, schema, or service is PascalCase (`Order.ts`). A module of functions is camelCase (`pageCount.ts`). Files `naming.exempt` lists keep the case their tool gives them.

### Name a file for its main export

A file with one main export takes its name, in the same case.

| Don't write           | Write                     | Because the file holds              |
| --------------------- | ------------------------- | ----------------------------------- |
| `domain/errors.ts`    | `OrderNotFound.ts`        | one error class                     |
| `contract/HttpApi.ts` | `contract/OrderingApi.ts` | `OrderingApi`                       |
| `model/schema.ts`     | `Money.ts`, `Address.ts`  | two unrelated schemas, one per file |

A file that holds a family is named for the family, and every export carries the family's words. Every export counts, helpers included.

### Name a helper module for what it builds

Name a module of related functions for what they produce or do, never for a bare category.

| Don't write                           | Write                      |
| ------------------------------------- | -------------------------- |
| `query.ts`                            | `OrderFilters.ts`          |
| `decode.ts`                           | `ResponseDecoders.ts`      |
| `helpers.ts`, `common.ts`, `types.ts` | the noun the helpers serve |

### Never name a folder like a file beside it

`./model` and `./model/Order` must not point at unrelated code. Keep a slice's state in `model.ts` and its domain nouns in `domain/`.

### Keep `index.ts` for entries

`index.ts` means "this is the way in". Use it only for a context entry, a slice entry, or a page. Anywhere else, name the file for what it holds: `api/baseUrl.ts`, not `api/index.ts`.

### Give each module in a package its own name

Two modules in one package never share a name, so a search for `pagination.ts` finds one file. Ports and their adapters repeat on purpose (below), and so do role files such as `model.ts` and `update.ts`.

### Add the kind when the noun alone misleads

A bare domain noun claims to be the thing itself. When the file holds something about the noun, say what: `ProductCatalog.ts` is the service that lists products.

### Name ports and adapters alike, and the folder for the technology

A port in `application/` is named for its capability. Each adapter takes the same file name, in a folder named for its technology:

```txt
application/OrderStore.ts                 the port
infrastructure/Postgres/OrderStore.ts     the Postgres adapter
infrastructure/Demo/OrderStore.ts         the in-memory adapter
```

Consumers alias an adapter module by its technology: `import * as PostgresStore from "../infrastructure/Postgres/OrderStore"`.

### Scripts, fixtures, and translations

- A command-line script lives in a folder `cliFolders` lists, named verb first: `cli/importOrders.ts` runs as `bun run import:orders`.
- Recorded data lives in a `fixtures/` folder.
- A translation from another context is named for its direction: `FromBilling.ts` in the context that reads, `ToBilling.ts` in the context that writes.

### Words the glossary retires

A word in a term's `retire` list in `domain-model.json` fails `check:naming` in code, comments, and file names. It matches whole words in any case: `Cart` fails `guestCart` and `cart_total`, but not `shoppingcart`. A phrase matches across spaces but not punctuation. `naming.outsideWords` in the config lists files where another tool spells a retired word for you, and `naming.wireNames` lists bare field names that keep their wire spelling.

### Tests

A test is `<module>.test.ts` beside its module. `naming.orphanTests` lists the exceptions, such as a test that compares two modules.

### Opt-in checks for UI code

- `naming.sharedHooks` names the one folder that may group shared hooks. Any other `hooks/` folder fails, so a hook sits beside the components that use it.
- `naming.componentPrefixes` maps each `ui/` folder to the words its components start with. A new `ui/` folder fails until it declares a prefix.
