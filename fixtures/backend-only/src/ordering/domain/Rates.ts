/** The tax and discount rates a total uses. */
const rates = { tax: 0.2, discount: 0.1 }

/** Fails no-unexported-module-destructuring: `tax` is a local name taken out of `rates`. */
const { tax } = rates

/** Passes: an exported destructuring names the module's exports. */
export const { discount } = rates

export const withTax = (amount: number) => amount * (1 + tax)
