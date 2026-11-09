import { Context, Effect } from "effect"
import * as Order from "../domain/Order"

/** Reads stored orders. */
export interface Shape {
	readonly find: (id: string) => Effect.Effect<Order.Order>
}

export class Service extends Context.Service<Service, Shape>()("ordering/application/OrderStore/Service") {}

/** A store with no orders but the empty one. */
export const empty: Shape = { find: (id) => Effect.succeed(Order.make(id)) }
