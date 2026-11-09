# Testing

A test earns its place when it fails for a mistake someone could make in this codebase. Keep the suite small enough that you can read every test of a feature before you change it.

## Name the mistake each test catches

Before you write or keep a test, answer five questions:

1. Which mistake in our code does it catch? Name it in one sentence, such as "an older search response replaces a newer one". With no answer, delete the test.
2. Would it fail if someone made that mistake? Break the code on purpose to check. If it wouldn't, strengthen it.
3. Do types or lint already prevent the mistake? Then the test adds nothing.
4. Does another test catch the same mistake? Keep the clearer one.
5. Does it check only what a dependency does? Effect, Schema, and the UI framework test their own behavior.

## Skip what something else already checks

Don't test:

- Dependency behavior, such as `Schema.String` rejecting a number or Effect running a finalizer.
- Rules that types or checks enforce, such as imports between bounded contexts, names, and schema shapes. The lint rules, `effect-domain check-program`, and `effect-domain check-naming` fail on those.
- Code that only forwards its arguments.
- Markup structure, class names, or large snapshots. They change with every redesign and catch no behavior.

Do test the rules you add on top. `Schema.Int` needs no test. An `Order` that refuses more than `Order.maxLines` lines does.

## Test each layer for its own job

Each folder has one job, and its tests check that job. Don't repeat business-rule cases in component and browser tests. Add a broader test only when it catches a different mistake, such as wrong wiring.

| Code                    | A test checks                                                                                                                                     | Tool                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `domain/`               | Our rules, with valid inputs, invalid inputs, and limits                                                                                          | `@effect/vitest`, with `it.prop` for general rules |
| `application/` services | Results, typed failures, the writes it must make, and the writes it must not make                                                                 | `@effect/vitest` with test layers                  |
| `infrastructure/`       | The request we build and how we decode a recorded response                                                                                        | `@effect/vitest`                                   |
| `contract/`             | Transformations we write, such as a schema that decodes a wire format, and that an encoded value decodes back to the same value                   | `@effect/vitest`                                   |
| Frontend state          | The state and the effects it requests after a sequence of events, and that route state survives a round trip through the URL and rejects bad URLs | `@effect/vitest`                                   |
| `presentation/`         | The view data it derives, not markup                                                                                                              | `@effect/vitest`                                   |
| Components and views    | What the user sees and can do after an action                                                                                                     | The UI framework's test tools, or Testing Library  |
| Critical journeys       | The browser, the server, and the storage working together                                                                                         | Playwright                                         |

Import `it`, `assert`, and `describe` from `@effect/vitest` in every test, even a pure one.

## Control dependencies with test layers

A test controls Effect dependencies by providing different layers. Keep the code under test real, and replace only what it depends on.

```ts
import { assert, it } from "@effect/vitest"
import { Effect, Layer, Option, Schema } from "effect"
import * as Order from "../domain/Order"
import * as Orders from "./Orders"
import * as OrderStore from "./OrderStore"

const missingId = Schema.decodeSync(Order.Id)("0b6f2d4e-8a1c-4f4e-9d2a-3c5b7e9f1a2b")

const layerEmptyStore = Layer.mock(OrderStore.Service, {
	findById: () => Effect.succeed(Option.none()),
})

it.effect("refuses an id that no order has", () =>
	Effect.gen(function* () {
		const orders = yield* Orders.Service
		const error = yield* Effect.flip(orders.getById(missingId))
		assert.strictEqual(error._tag, "OrderNotFoundError")
	}).pipe(Effect.provide(Orders.layerNoDeps.pipe(Layer.provide(layerEmptyStore))))
)
```

- Write each test layer in the test file, with explicit responses. `Layer.mock` fills only the methods you give, and a call to any other method fails the test.
- Compose test layers with `Layer.provide`, and yield the service in the test. A helper may build fixture data, but never takes a service, a method, a client, or a behavior flag as an argument. It reads services from the environment.
- Give a shared test HTTP client a private `Context.Service` class, such as `ApiClient`, with a static `layer`, and provide it with `Effect.provide(ApiClient.layer)`.
- Never read seed data, a demo database, or another shared data file in a test. A new record in that file breaks an unrelated test, and the reader can't see the inputs. Write the records the test needs into an in-memory store, such as SQLite opened on `":memory:"`.
- Never use `vi.mock`, `vi.spyOn`, or `vi.fn`. Assert on the result, the failure, or what the test layer received, recorded in a `Ref` made inside the test. Don't assert inside the test service, where a failure shows up as an error in the code under test.
- Start a long-running runtime or fiber inside `it.effect`, in the test's scope, so its work runs on the test clock and stops with the test.
- Release a rendered page or a stubbed global with `Effect.acquireRelease`, never `try`/`finally`. Cleanup then runs even when an assertion fails.
- Use `TestClock.adjust` for every delay, never `vi.useFakeTimers` or a real sleep.
- Use `Deferred` to decide when a response arrives, to test that an older response doesn't replace a newer one.
- Share a layer across a `describe` block with `layer(...)` from `@effect/vitest`. Build mutable state inside each test, so tests pass in any order.

## Test components through what the user sees

Render with the UI framework's test tools, or with Testing Library, and act with `user-event`. Find elements by role, label, and accessible name. Check what appears on screen: text, a pending state, an error, where focus goes.

Test frontend state through its own update function and the effects it requests, with test layers for the services those effects use. A fake runtime tests the fake, not our wiring.

## Keep browser journeys few

Playwright tests cover the journeys that would stop someone using the app, such as signing in, placing an order, and paying an invoice. Add one only when no smaller test catches the mistake.

- Run them against a production build, not the dev server.
- Use the real services, with local storage seeded with a small fixture set.
- Name each file for its journey, such as `placeOrder.spec.ts`, in an `e2e/` folder of the app.
- Fix a flaky journey. Don't hide it with retries.

## Write tests a reader can follow

- Name each test for the behavior it checks, in glossary terms: "rejects placing an order twice", not "works".
- Keep the setup, the action, and the expected result in the test body.
- Write the expected value out. Don't compute it with the code under test, and don't only check that something exists.
- Keep fixtures small, and name their builders `makeX`.
- Follow the source lint rules: `assert.isDefined` instead of `x!`, decoders instead of `as`.
- For a bug fix, write the smallest test that fails on the bug, then fix it.
- When a comment states a rule, a test proves it, as [GUIDELINES.md](GUIDELINES.md#comments) requires.

## Put each test beside its module

Name a test `<module>.test.ts`, beside the module it tests. `effect-domain check-naming` fails a test with no module of that name. `naming.orphanTests` in `architecture.config.ts` lists the exceptions, such as a test that compares two modules. Only Playwright tests live apart, in `e2e/`.

## Remove tests that protect nothing

When you change a feature, review its tests with the five questions: keep, strengthen, merge, or delete each one. Before you delete a test, check that no other test covers its rule, failure case, or wiring. Understand a failing test before you change its assertion. Don't aim for a test count or a coverage percentage. Use the coverage report to find untested rules.

## Run Vitest west of UTC

Set a time zone west of UTC in `vitest.config.ts`, such as `America/Sao_Paulo`. In that zone, code that handles a calendar date in UTC shows the day before, so a date test fails. Write the expected day out, and don't change the zone to make a test pass.
