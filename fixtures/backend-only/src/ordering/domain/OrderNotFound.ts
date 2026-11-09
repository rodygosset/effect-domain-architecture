import { Schema } from "effect"

/** Narrow: one error and nothing else. It belongs in Order.ts as Order.NotFound. */
export class OrderNotFound extends Schema.TaggedError<OrderNotFound>()("OrderNotFound", { id: Schema.String }) {}
