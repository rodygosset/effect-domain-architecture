# Coding guidelines

These rules override generic TypeScript habits. Follow them in new code, and fix old code when you edit it. Files the config lists under `vendored` are exempt.

## Function shape

An expression body is an arrow. A block body is a `function`.

Write a plain function that takes all its arguments. Add `dual` only when a caller uses the function in a pipe, and give the data-first signature a return type when inference would widen it.

| Case                                       | Write                                                               |
| ------------------------------------------ | ------------------------------------------------------------------- |
| Returns an expression                      | `const lineId = (line: Line) => line.id`, `.map((line) => line.id)` |
| Named helper with a block                  | `function normalize(raw: string) { … }`                             |
| Inline callback with a block               | anonymous `function () { … }`                                       |
| Callback to a function in `namedCallbacks` | named `function syncTotals() { … }`, so it shows in stack traces    |
| Handler passed by reference                | `function handleSubmit() { … }`, then pass `handleSubmit`           |
| Object property returning an expression    | `{ total: (order) => order.total }`                                 |
| Object property with a block               | method shorthand `{ total(order) { … } }`                           |

```ts
const remove = (order: Order, lineId: Line.Id) => Order.withLines(order, Order.linesWithout(order, lineId))

function normalize(raw: string) {
	const trimmed = raw.trim()
	return trimmed.toLowerCase()
}

emitter.on("saved", function () {
	refresh()
	close()
})
```

The `namedCallbacks` option of the function-shape rules lists the callees whose callbacks need a name. A UI framework sets it to its effect hooks. `bunx effect-domain fix-function-shape` rewrites existing code into these shapes.

## Comments

A comment says what a thing is for and where it is used. The code says how. Write one or two sentences as a `/** … */` doc comment, so it shows on hover.

| On                                | Say                                                           | Example                                                                    |
| --------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A service's `Service` class       | What it does and who uses it                                  | Reads orders by id, for the order page and the HTTP API.                   |
| Each `Shape` member               | What the caller gets, and the one rule they must know         | The order with this id. Refuses an id that no order has.                   |
| A schema, class, or exported type | The real thing it stands for, and where it comes from or goes | An invoice as the accounting system sends it, one line per product.        |
| A static, getter, or helper       | Only the rule its name doesn't say                            | Which line stays selected after one is removed.                            |
| A surprising line                 | The reason, not the steps                                     | Totals round per line, because the tax office rounds each line on its own. |

Write it the way you would explain it to a colleague, following [WRITING.md](WRITING.md):

- Use the words of the people who use the software, the words the glossary in `domain-model.json` keeps. Avoid architecture words such as port, adapter or projection. When the code's name is technical, say what it means.
- Write in the present tense and the active voice: "Refuses an id…", not "An error is thrown when…".
- Use a colon only before a list, and no semicolons, em dashes, or arrows.
- Name the role, not the file: "for the order page", not "used by `page.ts`".
- State the rule, not its category: "Skips unreadable rows and counts them", not "Handles errors".
- Delete a comment that only repeats the name or the type. Don't comment parameters, return types, the steps of a function, or a file's history, and don't write `@param` or `@returns`.

A comment that states a rule needs a test that proves it. Without one, write the test or cut the comment down to the purpose. When you change what code does, change its comment in the same commit.
