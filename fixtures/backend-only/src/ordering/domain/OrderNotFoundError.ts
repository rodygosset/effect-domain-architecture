import { Schema } from "effect"

/** Narrow: one error and nothing else. It belongs in Order.ts as Order.NotFoundError. */
export class OrderNotFoundError extends Schema.TaggedError<OrderNotFoundError>()("OrderNotFoundError", {
	id: Schema.String,
}) {}
