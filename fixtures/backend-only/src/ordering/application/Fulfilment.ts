import { Effect } from "effect"
import * as Order from "../domain/Order"
import * as CurrentOrder from "./CurrentOrder"
import * as OrderStore from "./OrderStore"

/** Fails service-parameter: the store arrives as an argument instead of being yielded. */
export const fulfil = (store: OrderStore.Shape, id: string) => store.find(id)

/** Passes: the store is yielded, so the type names the requirement. */
export const fulfilStored = Effect.fn("Fulfilment.fulfilStored")(function* (id: string) {
	const store = yield* OrderStore.Service
	return yield* store.find(id)
})

/** Passes: the current order is data, so a function may take it. */
export const isReady = (order: CurrentOrder.Shape) => !Order.isEmpty(order)

/** Passes: the command yields the request's order and hands the data to the pure check. */
export const check = Effect.fn("Fulfilment.check")(function* () {
	const order = yield* CurrentOrder.Service
	return isReady(order)
})
