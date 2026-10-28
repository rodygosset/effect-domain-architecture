# Effect Schema

Import with `import { Schema } from "effect"`. These are Effect 4 APIs, so check names in `repos/effect/packages/effect/src/Schema.ts`, not from memory of v3.

## Pick a constructor

| Shape                      | Schema                                                                |
| -------------------------- | --------------------------------------------------------------------- |
| Enum                       | `Schema.Literals([...] as const)`                                     |
| DTO or JSON                | `Schema.Struct({...})`                                                |
| Entity with methods        | `Schema.Class<Name>("Name")(struct)`, composed with `...Other.fields` |
| Composite id               | `Schema.TemplateLiteral([A, "-", B, "-", Schema.String])`             |
| Number from a query        | `Schema.FiniteFromString`, which rejects `NaN` and `Infinity`         |
| Optional URL or JSON field | `Schema.OptionFromOptional`                                           |
| Domain error               | `Schema.TaggedError<X>()("X", Schema.Struct({ id: Order.Id }))`       |
| HTTP error                 | `Schema.Error<X>("X")(ErrorBody, { httpApiStatus: 404 })`             |

Prefer these to `decodeTo`.

## Rules

- A schema and its type share one name: `export const Foo` and `export type Foo = typeof Foo.Type`. Never `FooSchema` or `FooType`.
- Write one schema per shape and derive its types. Write no interface beside it.
- Shapes that several places read live in their context's `domain/`, and browsers read them through the context's `contract` entry ([CONTEXTS.md](CONTEXTS.md)). State that only a frontend workflow uses stays in that workflow.
- Iterate a `Literals` schema with `.literals`, as `Order.Status.literals`.
- Parse user and URL input with `Schema.decodeUnknownOption`, not `decodeUnknownSync`, and JSON text with `Schema.fromJsonString`.
- Compare with `Schema.toEquivalence` or `Equal.equals`, never stringified values.
- Build values with `X.make(...)`: `Order.make({...})`, `Order.Id.make(...)`.
- Encode synchronously (`Schema.encodeSync`) only where a framework API is synchronous, such as a router's search serializer.

## Absence

Lint enforces these rules.

| Value                                                         | Shape                                 |
| ------------------------------------------------------------- | ------------------------------------- |
| Argument, return value, field, state, or `let` you own        | `Option`, starting at `Option.none()` |
| Field at a URL, JSON, or HTTP boundary                        | `Schema.OptionFromOptional`           |
| Field at a nullable foreign boundary, such as a search engine | `Schema.OptionFromOptionalNullOr`     |
| Field that is an `Option` on both sides                       | `Schema.Option`                       |
| A prop of a function the `propsFunctions` option names        | `name?: Type`                         |
| A foreign shape in `infrastructure/`, such as a request body  | The foreign library's own shape       |

- Name Option locals, arguments, props, and getters `maybeName`. Schema field names keep their wire spelling.
- Convert a foreign `undefined` with `Option.fromUndefinedOr` and a foreign `null` with `Option.fromNullishOr`, where the value enters your code. Unwrap with `Option.getOrUndefined` only where a foreign API takes it.
- Never use `null` for absence, and never write `name?: Type | undefined`.
- Never use `Schema.optional`, `optionalKey`, `NullOr`, `NullishOr`, or `UndefinedOr`.

## Classes

Write helpers as methods. An arrow property (`helper = () => …`) becomes a field and breaks `toEquivalence`. Put equality, codecs, and constructors beside the class at module level ([NAMING.md](NAMING.md#domain-concept-modules)).

```ts
export class Order extends Schema.Class<Order>("Order")({
	// fields…
}) {
	apply(change: OrderChange.OrderChange): Order {
		return Match.value(change).pipe(
			Match.tagsExhaustive({
				AddedLine: (change) => Order.make({ ...this, lines: [...this.lines, change.line] }),
				// other cases…
			})
		)
	}
}

export const isSame = Schema.toEquivalence(Order)
```

Derived values go on the class as getters, not in UI state.

## Wiring

Reuse one schema everywhere, never a second struct per use.

| Use          | Pattern                                                       |
| ------------ | ------------------------------------------------------------- |
| Router input | The URL schema through `Schema.toStandardSchemaV1`            |
| HttpApi      | `query`, `success`, and `error` from the context's `contract` |
| Ad hoc parse | `Schema.Tuple([...]).pipe(Schema.decodeUnknownOption)(parts)` |

A codec for one schema class sits in the class's module, such as `Order.FromRow` for the database and `Order.FromJson` for HTTP. When both exist, route them through one flat shape, so a value has one writable shape.
